import { createClient } from "@supabase/supabase-js"
import { z } from "zod"
import {
  validateCronSecret,
  validateInput,
  errorResponse,
  successResponse,
  ERROR_MESSAGES,
} from "@/lib/api-security"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const executeSchema = z.object({
  type: z.enum(["recurring", "meeting_trigger", "scheduled"]).optional(),
})

export async function POST(request: Request) {
  try {
    // 1. CRON Secret validation - REQUIRED (fail closed)
    if (!validateCronSecret(request)) {
      console.error("[Automations] Unauthorized request - invalid or missing CRON_SECRET")
      return errorResponse(ERROR_MESSAGES.UNAUTHORIZED, 401)
    }

    // 2. Validate input
    const body = await request.json()
    const validation = validateInput(executeSchema, body)
    if (!validation.success) return validation.error

    const { type } = validation.data

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    if (type === "recurring") {
      await executeRecurringAutomations(supabase)
    } else if (type === "meeting_trigger") {
      await executeMeetingTriggerAutomations(supabase)
    } else if (type === "scheduled") {
      await executeScheduledAutomations(supabase)
    } else {
      // Execute all types if no type specified (default run)
      await executeRecurringAutomations(supabase)
      await executeMeetingTriggerAutomations(supabase)
      await executeScheduledAutomations(supabase)
    }

    return successResponse({ success: true })
  } catch (error) {
    console.error("[Automations] Error executing automations:", error)
    return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
  }
}

async function executeRecurringAutomations(supabase: ReturnType<typeof createClient>) {
  const now = new Date()

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

async function executeScheduledAutomations(supabase: ReturnType<typeof createClient>) {
  const now = new Date()

  // Get all active scheduled automations that are due
  const { data: automations, error } = await supabase
    .from("automations")
    .select(`
      *,
      automation_scheduled_config(*)
    `)
    .eq("type", "scheduled")
    .eq("is_active", true)

  if (error) {
    console.error("[Automations] Error fetching scheduled automations:", error)
    return
  }

  for (const automation of automations || []) {
    const config = automation.automation_scheduled_config?.[0]
    if (!config) continue

    // Check if already executed
    if (config.executed) continue

    // Check if it's time to send (scheduled_at has passed)
    const scheduledAt = new Date(config.scheduled_at)
    if (scheduledAt > now) continue

    // Send the message to the specific conversation
    await sendScheduledMessage(supabase, automation, config)

    // Mark as executed
    await supabase
      .from("automation_scheduled_config")
      .update({ executed: true })
      .eq("id", config.id)

    // Optionally deactivate the automation since it's a one-time message
    await supabase
      .from("automations")
      .update({ is_active: false })
      .eq("id", automation.id)

    console.log(`[Automations] Executed scheduled automation ${automation.id}`)
  }
}

async function sendScheduledMessage(
  supabase: ReturnType<typeof createClient>,
  automation: Record<string, unknown>,
  config: Record<string, unknown>
) {
  const coachId = automation.coach_id as string
  const messageContent = automation.message_content as string
  const conversationId = config.conversation_id as string

  // Insert the message
  const { data: newMessage, error: msgError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: coachId,
      content: messageContent,
    })
    .select()
    .single()

  if (msgError) {
    console.error("[Automations] Error sending scheduled message:", msgError)
    return
  }

  // Attach key results if any
  const { data: keyResults } = await supabase
    .from("automation_key_results")
    .select("quarterly_key_result_id")
    .eq("automation_id", automation.id as string)

  if (keyResults && keyResults.length > 0 && newMessage) {
    const inserts = keyResults.map((kr: Record<string, unknown>) => ({
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
        conversationId,
        senderId: coachId,
        content: messageContent,
      }),
    })
  } catch (notifErr) {
    console.error("[Automations] Failed to send push notification:", notifErr)
  }
}

async function sendAutomationMessage(
  supabase: ReturnType<typeof createClient>,
  automation: Record<string, unknown>,
  meeting?: Record<string, unknown>
) {
  const coachId = automation.coach_id as string
  const messageContent = automation.message_content as string

  // Get conversations linked to this automation
  const { data: linkedConvos } = await supabase
    .from("automation_conversations")
    .select("conversation_id")
    .eq("automation_id", automation.id as string)

  if (!linkedConvos || linkedConvos.length === 0) {
    console.log(`[Automations] No conversations linked to automation ${automation.id}`)
    return
  }

  // Send message to each linked conversation
  for (const link of linkedConvos) {
    const conversationId = link.conversation_id

    // Insert the message
    const { data: newMessage, error: msgError } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
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
      .eq("automation_id", automation.id as string)

    if (keyResults && keyResults.length > 0 && newMessage) {
      const inserts = keyResults.map((kr: Record<string, unknown>) => ({
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
          conversationId,
          senderId: coachId,
          content: messageContent,
        }),
      })
    } catch (notifErr) {
      console.error("[Automations] Failed to send push notification:", notifErr)
    }
  }

  console.log(`[Automations] Sent message for automation ${automation.id} to ${linkedConvos.length} conversations`)
}

// Also support GET for easy testing (but require auth)
export async function GET(request: Request) {
  // For Vercel Cron, GET requests are sent with the CRON_SECRET
  if (validateCronSecret(request)) {
    // Execute all automation types
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    try {
      await executeRecurringAutomations(supabase)
      await executeMeetingTriggerAutomations(supabase)
      await executeScheduledAutomations(supabase)
      return successResponse({ success: true, executed: ["recurring", "meeting_trigger", "scheduled"] })
    } catch (error) {
      console.error("[Automations] Error executing automations:", error)
      return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
    }
  }
  
  return successResponse({ 
    message: "Automations execution endpoint. Cron runs every 5 minutes.",
    types: ["recurring", "meeting_trigger", "scheduled"]
  })
}
