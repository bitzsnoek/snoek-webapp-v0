import { createClient as createServerClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { successResponse, errorResponse, ERROR_MESSAGES, validateInput, schemas } from "@/lib/api-security"
import { z } from "zod"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const testAutomationSchema = z.object({
  automationId: schemas.uuid,
})

export async function POST(request: Request) {
  try {
    // Verify user is authenticated
    const userSupabase = await createClient()
    const { data: { user } } = await userSupabase.auth.getUser()

    if (!user) {
      return errorResponse(ERROR_MESSAGES.UNAUTHORIZED, 401)
    }

    const body = await request.json().catch(() => null)
    const validation = validateInput(testAutomationSchema, body)
    if (!validation.success) return validation.error
    const { automationId } = validation.data

    // Use service role to send messages
    const supabase = createServerClient(supabaseUrl, supabaseServiceKey)

    // Get the automation
    const { data: automation, error: autoError } = await supabase
      .from("automations")
      .select(`
        *,
        automation_scheduled_config(*),
        automation_conversations(conversation_id)
      `)
      .eq("id", automationId)
      .single()

    if (autoError || !automation) {
      console.error("[Test] Error fetching automation:", autoError)
      return errorResponse("Automation not found", 404)
    }

    console.log("[v0] Automation fetched:", JSON.stringify({
      id: automation.id,
      type: automation.type,
      scheduled_config: automation.automation_scheduled_config,
      conversations: automation.automation_conversations,
    }))

    // Verify the user owns this automation (is the coach)
    if (automation.coach_id !== user.id) {
      return errorResponse(ERROR_MESSAGES.UNAUTHORIZED, 401)
    }

    // Determine which conversations to send to
    let conversationIds: string[] = []

    if (automation.type === "scheduled") {
      // For scheduled, use the conversation_id from config
      // Supabase returns object for single() or array otherwise - handle both
      const configData = automation.automation_scheduled_config
      const config = Array.isArray(configData) ? configData[0] : configData
      console.log("[v0] Scheduled config:", config)
      if (config?.conversation_id) {
        conversationIds = [config.conversation_id]
      }
    } else {
      // For recurring, use automation_conversations
      conversationIds = (automation.automation_conversations || []).map(
        (ac: { conversation_id: string }) => ac.conversation_id
      )
    }

    console.log("[v0] Conversation IDs:", conversationIds)

    if (conversationIds.length === 0) {
      return errorResponse("No conversations linked to this automation", 400)
    }

    console.log("[Test] Sending to conversations:", conversationIds)

    // Re-authorize each target conversation. The caller is already verified
    // as the automation's coach, but the automation could have been configured
    // with a conversation_id that doesn't belong to this coach. The service
    // role client bypasses RLS, so we must confirm ownership explicitly here.
    const { data: allowedConversations, error: convCheckError } = await supabase
      .from("conversations")
      .select("id")
      .in("id", conversationIds)
      .eq("coach_id", user.id)

    if (convCheckError) {
      console.error("[Test] Error verifying conversation ownership:", convCheckError)
      return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
    }

    const allowedIds = new Set((allowedConversations ?? []).map((c: { id: string }) => c.id))
    const authorizedConversationIds = conversationIds.filter((id) => allowedIds.has(id))

    if (authorizedConversationIds.length === 0) {
      return errorResponse(ERROR_MESSAGES.FORBIDDEN, 403)
    }

    // Send message to each conversation
    let successCount = 0
    for (const conversationId of authorizedConversationIds) {
      const { data: newMessage, error: msgError } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: automation.coach_id,
          content: automation.message_content,
        })
        .select()
        .single()

      if (msgError) {
        console.error("[Test] Error sending message:", msgError)
        continue
      }

      console.log("[Test] Message sent:", newMessage?.id)

      // Attach key results if any
      const { data: keyResults } = await supabase
        .from("automation_key_results")
        .select("quarterly_key_result_id")
        .eq("automation_id", automationId)

      if (keyResults && keyResults.length > 0 && newMessage) {
        const inserts = keyResults.map((kr: { quarterly_key_result_id: string }) => ({
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
            senderId: automation.coach_id,
            content: automation.message_content,
          }),
        })
      } catch (notifErr) {
        console.error("[Test] Failed to send push notification:", notifErr)
      }

      successCount++
    }

    return successResponse({ 
      success: true, 
      conversationCount: successCount,
      message: `Sent to ${successCount} conversation(s)` 
    })
  } catch (error) {
    console.error("[Test] Error:", error)
    return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
  }
}
