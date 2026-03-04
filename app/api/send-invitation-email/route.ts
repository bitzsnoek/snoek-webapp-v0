import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { email, founderName, invitationToken, senderName } = await request.json()

    if (!email || !founderName || !invitationToken) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const postmarkApiKey = process.env.POSTMARK_API_KEY
    if (!postmarkApiKey) {
      console.error("POSTMARK_API_KEY not configured")
      return NextResponse.json(
        { error: "Email service not configured" },
        { status: 500 }
      )
    }

    // Always use the production URL for invite links so they work for everyone
    const productionHost = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null)
      || `${request.nextUrl.protocol}//${request.headers.get("x-forwarded-host") || request.nextUrl.host}`
    const acceptLink = `${productionHost}/invitations/accept?token=${invitationToken}`

    const emailContent = `
    <p>Hi ${founderName},</p>
    
    <p>${senderName || "Your coach"} has invited you to join Snoek and collaborate on strategic planning.</p>
    
    <p>
      <a href="${acceptLink}" style="display: inline-block; padding: 10px 20px; background-color: #10b981; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
        Accept invitation
      </a>
    </p>
    
    <p>Or copy this link: <code>${acceptLink}</code></p>
    
    <p>This link will expire in 7 days.</p>
    
    <p>Best regards,<br/>Snoek</p>
    `

    // Send via Postmark
    const response = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": postmarkApiKey,
      },
      body: JSON.stringify({
        From: process.env.POSTMARK_FROM_EMAIL || "noreply@snoek.app",
        To: email,
        Subject: `You're invited to join Snoek`,
        HtmlBody: emailContent,
        TextBody: `Hi ${founderName},\n\n${senderName || "Your coach"} has invited you to join Snoek.\n\nVisit this link to accept: ${acceptLink}\n\nThis link expires in 7 days.`,
        MessageStream: "outbound",
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error("Postmark API error:", error)
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 500 }
      )
    }

    const result = await response.json()
    return NextResponse.json({ success: true, messageId: result.MessageID })
  } catch (error) {
    console.error("Email sending error:", error)
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    )
  }
}
