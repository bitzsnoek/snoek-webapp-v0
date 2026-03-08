import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// This endpoint is called by Supabase Cron to execute automations
// It handles both recurring messages and meeting-triggered messages

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: Request) {
  try {
    // Verify the request is from Supabase Cron (basic auth check)
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const body = await request.json()
    const { type } = body // "recurring" or "meeting_trigger"

    if (type === "recurring") {
      await executeRecurringAutomations(supabase)
    } else if (type === "meeting_trigger") {
      await executeMeetingTriggerAutomations(supabase)
    } else {
      // Execute both if no type specified (default hourly run)
      await executeRecurringAutomations(supabase)
      await executeMeetingTriggerAutomations(supabase)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Automations] Error executing automations:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

async function executeRecurringAutomations(supabase: ReturnType<typeof createClient>) {
  const now = new Date()
  const currentHour = now.getUTCHours()
  const currentDay = now.getUTCDay() // 0 = Sunday, 6 = Saturday
  const currentDayOfMonth = now.getUTCDate()

  // Get all active recurring automations with their configs
  const { data: automations, error } = await supabase
    .from("automations")
    .select(`
      *,
      automation_recurring_config(*),
      companies(timezone)
    `)
    .eq("type", "recurring")
    .eq("is_active", true)

  if (error) {
    console.error("[Automations] Error fetching recurring automations:", error)
    return
  }

  for (const automation of automations || []) {
    const config = automation.automation_recurring_config?.[0]
    if (!config) continue

    const companyTimezone = automation.companies?.timezone || "UTC"
    
    // Convert current UTC time to company timezone
    const localTime = new Date(now.toLocaleString("en-US", { timeZone: companyTimezone }))
    const localHour = localTime.getHours()
    const localDay = localTime.getDay()
    const localDayOfMonth = localTime.getDate()

    // Parse the time_of_day (e.g., "09:00")
    const [scheduledHour] = config.time_of_day.split(":").map(Number)

    // Check if this automation should run now
    let shouldRun = false

    if (config.frequency === "daily") {
      shouldRun = localHour === scheduledHour
    } else if (config.frequency === "weekly") {
      shouldRun = localDay === config.day_of_week && localHour === scheduledHour
    } else if (config.frequency === "monthly") {
      shouldRun = localDayOfMonth === config.day_of_month && localHour === scheduledHour
    }

    if (shouldRun) {
      await sendAutomationMessage(supabase, automation)
    }
  }
}

async function executeMeetingTriggerAutomations(supabase: ReturnType<typeof createClient>) {
  const now = new Date()

  // Get all active meeting trigger automations
  const { data: automations, error } = await supabase
    .from("automations")
    .select(`
      *,
      automation_meeting_config(*)
    `)
    .eq("type", "meeting_trigger")
    .eq("is_active", true)

  if (error) {
    console.error("[Automations] Error fetching meeting trigger automations:", error)
    return
  }

  for (const automation of automations || []) {
    const config = automation.automation_meeting_config?.[0]
    if (!config) continue

    // Find meetings that match the trigger time
    const offsetMs = config.hours_offset * 60 * 60 * 1000 // hours to ms
    
    let meetingTimeWindow: { start: Date; end: Date }
    
    if (config.trigger_type === "before") {
      // For "before" triggers, look for meetings starting in X hours
      meetingTimeWindow = {
        start: new Date(now.getTime() + offsetMs - 30 * 60 * 1000), // -30 min buffer
        end: new Date(now.getTime() + offsetMs + 30 * 60 * 1000),   // +30 min buffer
      }
    } else {
      // For "after" triggers, look for meetings that ended X hours ago
      meetingTimeWindow = {
        start: new Date(now.getTime() - offsetMs - 30 * 60 * 1000),
        end: new Date(now.getTime() - offsetMs + 30 * 60 * 1000),
      }
    }

    // Get meetings for this company within the time window
    const { data: meetings } = await supabase
      .from("meetings")
      .select("*")
      .eq("company_id", automation.company_id)
      .gte(config.trigger_type === "before" ? "start_time" : "end_time", meetingTimeWindow.start.toISOString())
      .lte(config.trigger_type === "before" ? "start_time" : "end_time", meetingTimeWindow.end.toISOString())

    if (meetings && meetings.length > 0) {
      // Check if we've already sent a message for these meetings
      for (const meeting of meetings) {
        const logKey = `${automation.id}-${meeting.id}-${config.trigger_type}`
        
        const { data: existingLog } = await supabase
          .from("automation_execution_log")
          .select("id")
          .eq("log_key", logKey)
          .single()

        if (!existingLog) {
          await sendAutomationMessage(supabase, automation, meeting)
          
          // Log the execution to prevent duplicates
          await supabase.from("automation_execution_log").insert({
            automation_id: automation.id,
            meeting_id: meeting.id,
            log_key: logKey,
          })
        }
      }
    }
  }
}

async function sendAutomationMessage(
  supabase: ReturnType<typeof createClient>,
  automation: any,
  meeting?: any
) {
  const companyId = automation.company_id
  const coachId = automation.coach_id
  const messageContent = automation.message_content

  // Get all founders in this company
  const { data: members } = await supabase
    .from("company_members")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("role", "founder")

  if (!members || members.length === 0) return

  // Get or create conversations with each founder
  for (const member of members) {
    if (!member.user_id) continue

    // Find existing conversation
    let { data: conversation } = await supabase
      .from("conversations")
      .select("id")
      .eq("company_id", companyId)
      .eq("coach_id", coachId)
      .eq("founder_id", member.user_id)
      .single()

    // Create conversation if it doesn't exist
    if (!conversation) {
      const { data: newConvo } = await supabase
        .from("conversations")
        .insert({
          company_id: companyId,
          coach_id: coachId,
          founder_id: member.user_id,
        })
        .select()
        .single()
      conversation = newConvo
    }

    if (!conversation) continue

    // Insert the message
    const { data: newMessage, error: msgError } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversation.id,
        sender_id: coachId,
        content: messageContent,
      })
      .select()
      .single()

    if (msgError) {
      console.error("[Automations] Error sending message:", msgError)
      continue
    }

    // Attach key results if any
    const { data: keyResults } = await supabase
      .from("automation_key_results")
      .select("quarterly_key_result_id")
      .eq("automation_id", automation.id)

    if (keyResults && keyResults.length > 0 && newMessage) {
      const inserts = keyResults.map((kr: any) => ({
        message_id: newMessage.id,
        quarterly_key_result_id: kr.quarterly_key_result_id,
      }))
      
      await supabase.from("message_key_results").insert(inserts)
    }

    // Send push notification
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ""}/api/chat/send-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversation.id,
          senderId: coachId,
          content: messageContent,
        }),
      })
    } catch (notifErr) {
      console.error("[Automations] Failed to send push notification:", notifErr)
    }
  }

  console.log(`[Automations] Sent message for automation ${automation.id} to ${members.length} founders`)
}

// Also support GET for easy testing
export async function GET(request: Request) {
  return NextResponse.json({ 
    message: "Automations execution endpoint. Use POST to trigger automations.",
    usage: "POST with body: { type: 'recurring' | 'meeting_trigger' }"
  })
}
