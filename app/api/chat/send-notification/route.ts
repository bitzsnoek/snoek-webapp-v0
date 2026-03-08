import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { conversationId, senderId, content } = body

    if (!conversationId || !senderId || !content) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Get the conversation to find the recipient
    const { data: conversation, error: convoError } = await supabase
      .from("conversations")
      .select("coach_id, founder_id, company_id")
      .eq("id", conversationId)
      .single()

    if (convoError || !conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      )
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
      return NextResponse.json({ success: true, sent: 0 })
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
      return NextResponse.json(
        { success: false, error: "Failed to send push notifications" },
        { status: 500 }
      )
    }

    // Update last_used_at for the tokens we used
    const tokenValues = pushTokens.map((t) => t.token)
    await supabase
      .from("push_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .in("token", tokenValues)

    return NextResponse.json({ success: true, sent: messages.length })
  } catch (error) {
    console.error("Error sending push notification:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
