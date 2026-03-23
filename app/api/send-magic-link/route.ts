import { createClient } from "@supabase/supabase-js"
import { NextRequest } from "next/server"
import { z } from "zod"
import {
  checkRateLimit,
  getRateLimitKey,
  validateInput,
  errorResponse,
  successResponse,
  ERROR_MESSAGES,
  schemas,
} from "@/lib/api-security"

const sendMagicLinkSchema = z.object({
  email: schemas.email,
  redirectTo: z.string().max(2000).optional(),
})

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting - strict for email endpoints
    const rateLimitKey = getRateLimitKey(request, "magic-link")
    const rateLimit = checkRateLimit(rateLimitKey, 5, 300000) // 5 per 5 minutes
    if (!rateLimit.allowed) {
      return errorResponse(ERROR_MESSAGES.RATE_LIMITED, 429)
    }

    // 2. Validate input
    const body = await request.json()
    const validation = validateInput(sendMagicLinkSchema, body)
    if (!validation.success) return validation.error

    const { email, redirectTo } = validation.data

    // 3. Check service configuration
    const postmarkApiKey = process.env.POSTMARK_API_KEY
    if (!postmarkApiKey) {
      console.error("POSTMARK_API_KEY not configured")
      return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceRole) {
      return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
    }

    // Create admin client to generate magic link
    const adminSupabase = createClient(supabaseUrl, supabaseServiceRole, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Determine the production host
    let productionHost: string = ""
    if (redirectTo) {
      try {
        const parsed = new URL(redirectTo)
        productionHost = parsed.origin
      } catch {
        // Invalid URL, will use fallback
      }
    }
    if (!productionHost) {
      const forwardedHost = request.headers.get("x-forwarded-host")
      const forwardedProto = request.headers.get("x-forwarded-proto") || "https"
      productionHost =
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_PROJECT_PRODUCTION_URL
          ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
          : null) ||
        (forwardedHost ? `${forwardedProto}://${forwardedHost}` : null) ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
        `${request.nextUrl.protocol}//${request.nextUrl.host}`
    }

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
      return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
    }

    const hashedToken = data.properties?.hashed_token
    if (!hashedToken) {
      return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
    }

    const verifyUrl = new URL(`${productionHost}/api/auth/verify-magic-link`)
    verifyUrl.searchParams.set("token_hash", hashedToken)
    verifyUrl.searchParams.set("type", "magiclink")
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
      console.error("Postmark API error:", await response.text())
      return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
    }

    return successResponse({ success: true })
  } catch (error) {
    console.error("Send magic link error:", error)
    return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
  }
}
