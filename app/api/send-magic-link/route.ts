import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { email, redirectTo } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const postmarkApiKey = process.env.POSTMARK_API_KEY
    if (!postmarkApiKey) {
      console.error("POSTMARK_API_KEY not configured")
      return NextResponse.json({ error: "Email service not configured" }, { status: 500 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceRole) {
      return NextResponse.json({ error: "Auth service not configured" }, { status: 500 })
    }

    // Create admin client to generate magic link
    const adminSupabase = createClient(supabaseUrl, supabaseServiceRole, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Determine the redirect URL
    const productionHost =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : null) ||
      `${request.nextUrl.protocol}//${request.headers.get("x-forwarded-host") || request.nextUrl.host}`

    const finalRedirectTo = redirectTo || `${productionHost}/auth/callback`

    // Use Supabase admin to generate a magic link (without sending email)
    const { data, error } = await adminSupabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: finalRedirectTo,
      },
    })

    if (error) {
      console.error("Generate magic link error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // The generated action_link uses Supabase's Site URL (often localhost).
    // Extract the token params and rebuild the link using our actual host.
    const actionLink = data.properties?.action_link
    if (!actionLink) {
      return NextResponse.json({ error: "Failed to generate magic link" }, { status: 500 })
    }

    const actionUrl = new URL(actionLink)
    // The action link format is: {siteUrl}/auth/v1/verify?token=...&type=magiclink&redirect_to=...
    // We need to rebuild it as: {supabaseUrl}/auth/v1/verify?token=...&type=magiclink&redirect_to={ourRedirectTo}
    const verifyUrl = new URL(`${supabaseUrl}/auth/v1/verify`)
    verifyUrl.searchParams.set("token", actionUrl.searchParams.get("token") || "")
    verifyUrl.searchParams.set("type", actionUrl.searchParams.get("type") || "magiclink")
    verifyUrl.searchParams.set("redirect_to", finalRedirectTo)
    const magicLink = verifyUrl.toString()

    // Send the magic link email via Postmark
    const emailContent = `
    <p>Hi,</p>
    
    <p>You requested a magic link to sign in to Snoek.</p>
    
    <p>
      <a href="${magicLink}" style="display: inline-block; padding: 10px 20px; background-color: #10b981; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
        Sign in to Snoek
      </a>
    </p>
    
    <p>Or copy this link: <code>${magicLink}</code></p>
    
    <p>This link will expire in 1 hour. If you did not request this, you can safely ignore this email.</p>
    
    <p>Best regards,<br/>Snoek</p>
    `

    const response = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": postmarkApiKey,
      },
      body: JSON.stringify({
        From: process.env.POSTMARK_FROM_EMAIL || "noreply@snoek.app",
        To: email,
        Subject: "Your Snoek sign-in link",
        HtmlBody: emailContent,
        TextBody: `Hi,\n\nYou requested a magic link to sign in to Snoek.\n\nClick this link to sign in: ${magicLink}\n\nThis link will expire in 1 hour.\n\nBest regards,\nSnoek`,
        MessageStream: "outbound",
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error("Postmark API error:", errText)
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Send magic link error:", error)
    return NextResponse.json({ error: "Failed to send magic link" }, { status: 500 })
  }
}
