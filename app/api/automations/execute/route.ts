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
  type: z.enum(["recurring", "scheduled"]).optional(),
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

    console.log("[Automations] POST request received, type:", type || "all")

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const results: Record<string, number> = {}

    if (type === "recurring") {
      results.recurring = await executeRecurringAutomations(supabase)
    } else if (type === "scheduled") {
      results.scheduled = await executeScheduledAutomations(supabase)
    } else {
      // Execute all types if no type specified (default run)
      results.recurring = await executeRecurringAutomations(supabase)
      results.scheduled = await executeScheduledAutomations(supabase)
    }

    console.log("[Automations] Execution complete:", results)

    return successResponse({ success: true, executed: results })
  } catch (error) {
    console.error("[Automations] Error executing automations:", error)
    return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
  }
}

async function executeRecurringAutomations(supabase: ReturnType<typeof createClient>): Promise<number> {
  const now = new Date()
  let executedCount = 0

  console.log("[Automations] Checking recurring automations at:", now.toISOString())

  // Get all active recurring automations with their configs
  const { data: automations, error } = await supabase
    .from("automations")
    .select(`
      *,
      automation_recurring_config(*),
      clients(timezone)
    `)
    .eq("type", "recurring")
    .eq("is_active", true)

  if (error) {
    console.error("[Automations] Error fetching recurring automations:", error)
    return 0
  }

  console.log("[Automations] Found", automations?.length || 0, "active recurring automations")

  for (const automation of automations || []) {
    // Supabase returns object for single relations or array - handle both
    const configData = automation.automation_recurring_config
    const config = Array.isArray(configData) ? configData[0] : configData
    if (!config) {
      console.log("[Automations] No config for automation", automation.id)
      continue
    }

    const clientTimezone = automation.clients?.timezone || "UTC"
    
    // Convert current UTC time to client timezone
    const localTime = new Date(now.toLocaleString("en-US", { timeZone: clientTimezone }))
    const localHour = localTime.getHours()
    const localMinute = localTime.getMinutes()
    const localDay = localTime.getDay()
    const localDayOfMonth = localTime.getDate()

    // Parse the time_of_day (e.g., "09:30")
    const [scheduledHour, scheduledMinute] = config.time_of_day.split(":").map(Number)

    // Check if this automation should run now (within 5 minute window)
    let shouldRun = false
    const timeMatches = localHour === scheduledHour && Math.abs(localMinute - scheduledMinute) < 5

    if (config.frequency === "daily") {
      shouldRun = timeMatches
    } else if (config.frequency === "weekly") {
      shouldRun = localDay === config.day_of_week && timeMatches
    } else if (config.frequency === "monthly") {
      shouldRun = localDayOfMonth === config.day_of_month && timeMatches
    }

    console.log("[Automations] Automation", automation.id, {
      frequency: config.frequency,
      scheduledTime: config.time_of_day,
      localTime: `${localHour}:${localMinute}`,
      localDay,
      shouldRun
    })

    if (shouldRun) {
      // Check if we already ran this automation in this time window (prevent duplicates)
      const windowStart = new Date(now.getTime() - 5 * 60 * 1000) // 5 minutes ago
      const logKey = `recurring-${automation.id}-${now.toISOString().slice(0, 13)}` // hourly key
      
      const { data: existingLog } = await supabase
        .from("automation_execution_log")
        .select("id")
        .eq("log_key", logKey)
        .single()

      if (existingLog) {
        console.log("[Automations] Already executed this hour:", automation.id)
        continue
      }

      await sendAutomationMessage(supabase, automation)
      
      // Log the execution to prevent duplicates
      await supabase.from("automation_execution_log").insert({
        automation_id: automation.id,
        log_key: logKey,
      })
      
      executedCount++
    }
  }

  return executedCount
}

async function executeScheduledAutomations(supabase: ReturnType<typeof createClient>): Promise<number> {
  const now = new Date()
  let executedCount = 0

  console.log("[Automations] Checking scheduled automations at:", now.toISOString())

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
    return 0
  }

  console.log("[Automations] Found", automations?.length || 0, "active scheduled automations")

  for (const automation of automations || []) {
    // Supabase returns object for single() or array otherwise - handle both
    const configData = automation.automation_scheduled_config
    const config = Array.isArray(configData) ? configData[0] : configData
    if (!config) {
      console.log("[Automations] No config for automation", automation.id)
      continue
    }

    // Check if already executed
    if (config.executed) {
      console.log("[Automations] Automation", automation.id, "already executed")
      continue
    }

    // Check if it's time to send (scheduled_at has passed)
    const scheduledAt = new Date(config.scheduled_at)
    console.log("[Automations] Automation", automation.id, "scheduled for:", scheduledAt.toISOString(), "now:", now.toISOString())
    
    if (scheduledAt > now) {
      console.log("[Automations] Not yet time for automation", automation.id)
      continue
    }

    console.log("[Automations] Executing scheduled automation", automation.id)

    // Send the message to the specific conversation
    await sendScheduledMessage(supabase, automation, config)

    // Mark as executed
    const { error: updateError } = await supabase
      .from("automation_scheduled_config")
      .update({ executed: true })
      .eq("id", config.id)

    if (updateError) {
      console.error("[Automations] Error marking as executed:", updateError)
    }

    // Optionally deactivate the automation since it's a one-time message
    await supabase
      .from("automations")
      .update({ is_active: false })
      .eq("id", automation.id)

    console.log(`[Automations] Executed scheduled automation ${automation.id}`)
    executedCount++
  }

  return executedCount
}

async function sendScheduledMessage(
  supabase: ReturnType<typeof createClient>,
  automation: Record<string, unknown>,
  config: Record<string, unknown>
) {
  const coachId = automation.coach_id as string
  const messageContent = automation.message_content as string
  const conversationId = config.conversation_id as string

  console.log("[Automations] Sending scheduled message:", {
    automationId: automation.id,
    coachId,
    conversationId,
    contentLength: messageContent?.length
  })

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

  console.log("[Automations] Message inserted successfully:", newMessage?.id)

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

// Vercel Cron sends GET requests - this is the main entry point
export async function GET(request: Request) {
  console.log("[Automations] GET request received")
  
  // For Vercel Cron, GET requests are sent with the CRON_SECRET in Authorization header
  if (!validateCronSecret(request)) {
    // Also check for Vercel's internal cron header as fallback
    const isVercelCron = request.headers.get("x-vercel-cron") === "1"
    if (!isVercelCron) {
      console.log("[Automations] Unauthorized - no valid cron secret or header")
      return successResponse({ 
        message: "Automations execution endpoint. Cron runs every 5 minutes.",
        types: ["recurring", "scheduled"]
      })
    }
  }

  console.log("[Automations] Authorized cron request, executing all automations...")
  
  // Execute all automation types
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  try {
    const results = {
      recurring: await executeRecurringAutomations(supabase),
      scheduled: await executeScheduledAutomations(supabase),
    }
    
    console.log("[Automations] Cron execution complete:", results)
    return successResponse({ success: true, executed: results, timestamp: new Date().toISOString() })
  } catch (error) {
    console.error("[Automations] Error executing automations:", error)
    return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
  }
}
