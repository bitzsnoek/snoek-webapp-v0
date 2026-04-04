import { createClient as createServerClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { successResponse, errorResponse, ERROR_MESSAGES } from "@/lib/api-security"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: Request) {
  try {
    // Verify user is authenticated
    const userSupabase = await createClient()
    const { data: { user } } = await userSupabase.auth.getUser()
    
    if (!user) {
      return errorResponse(ERROR_MESSAGES.UNAUTHORIZED, 401)
    }

    const body = await request.json()
    const { automationId } = body

    if (!automationId) {
      return errorResponse("Missing automationId", 400)
    }

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

    // Verify the user owns this automation (is the coach)
    if (automation.coach_id !== user.id) {
      return errorResponse(ERROR_MESSAGES.UNAUTHORIZED, 401)
    }

    // Determine which conversations to send to
    let conversationIds: string[] = []

    if (automation.type === "scheduled") {
      // For scheduled, use the conversation_id from config
      const config = automation.automation_scheduled_config?.[0]
      if (config?.conversation_id) {
        conversationIds = [config.conversation_id]
      }
    } else {
      // For recurring, use automation_conversations
      conversationIds = (automation.automation_conversations || []).map(
        (ac: { conversation_id: string }) => ac.conversation_id
      )
    }

    if (conversationIds.length === 0) {
      return errorResponse("No conversations linked to this automation", 400)
    }

    console.log("[Test] Sending to conversations:", conversationIds)

    // Send message to each conversation
    let successCount = 0
    for (const conversationId of conversationIds) {
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
