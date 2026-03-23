import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import {
  requireAuth,
  requireConversationAccess,
  checkRateLimit,
  getRateLimitKey,
  validateInput,
  errorResponse,
  successResponse,
  ERROR_MESSAGES,
  schemas,
} from "@/lib/api-security"
import { NextRequest } from "next/server"

const sendNotificationSchema = z.object({
  conversationId: schemas.uuid,
  senderId: schemas.uuid,
  content: schemas.message,
})

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting
    const rateLimitKey = getRateLimitKey(request, "send-notification")
    const rateLimit = checkRateLimit(rateLimitKey, 30, 60000) // 30 per minute
    if (!rateLimit.allowed) {
      return errorResponse(ERROR_MESSAGES.RATE_LIMITED, 429)
    }

    // 2. Authentication
    const { user, error: authError } = await requireAuth()
    if (authError) return authError
    if (!user) return errorResponse(ERROR_MESSAGES.UNAUTHORIZED, 401)

    // 3. Validate input
    const body = await request.json()
    const validation = validateInput(sendNotificationSchema, body)
    if (!validation.success) return validation.error

    const { conversationId, senderId, content } = validation.data

    // 4. Verify the authenticated user matches the senderId
    if (user.id !== senderId) {
      return errorResponse(ERROR_MESSAGES.FORBIDDEN, 403)
    }

    // 5. Verify user has access to this conversation
    const { hasAccess } = await requireConversationAccess(user.id, conversationId)
    if (!hasAccess) {
      return errorResponse(ERROR_MESSAGES.FORBIDDEN, 403)
    }

    const supabase = await createClient()

    // Get the conversation to find the recipient
    const { data: conversation, error: convoError } = await supabase
      .from("conversations")
      .select("coach_id, founder_id, company_id")
      .eq("id", conversationId)
      .single()

    if (convoError || !conversation) {
      return errorResponse(ERROR_MESSAGES.NOT_FOUND, 404)
    }

    // Determine the recipient (the other participant in the conversation)
    const recipientId =
      senderId === conversation.coach_id
        ? conversation.founder_id
        : conversation.coach_id

    // Get the sender's name
    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", senderId)
      .single()

    const senderName = senderProfile?.full_name || "Someone"

    // Get the recipient's push tokens
    const { data: pushTokens, error: tokenError } = await supabase
      .from("push_tokens")
      .select("token, platform")
      .eq("user_id", recipientId)
      .eq("disabled", false)

    if (tokenError || !pushTokens || pushTokens.length === 0) {
      // No push tokens for this user, that's okay
      return successResponse({ success: true, sent: 0 })
    }

    // Send push notifications via Expo's push notification service
    const messages = pushTokens.map((tokenRecord) => ({
      to: tokenRecord.token,
      sound: "default",
      title: senderName,
      body: content.length > 100 ? content.substring(0, 100) + "..." : content,
      data: {
        conversationId,
        type: "new_message",
      },
    }))

    // Batch send to Expo push notification service
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(messages),
    })

    if (!response.ok) {
      console.error("Push notification failed:", await response.text())
      return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
    }

    // Update last_used_at for the tokens we used
    const tokenValues = pushTokens.map((t) => t.token)
    await supabase
      .from("push_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .in("token", tokenValues)

    return successResponse({ success: true, sent: messages.length })
  } catch (error) {
    console.error("Error sending push notification:", error)
    return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
  }
}
