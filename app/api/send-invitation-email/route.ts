import { NextRequest } from "next/server"
import { z } from "zod"
import {
  requireAuth,
  requireCompanyAccess,
  checkRateLimit,
  getRateLimitKey,
  validateInput,
  errorResponse,
  successResponse,
  ERROR_MESSAGES,
  schemas,
} from "@/lib/api-security"
import { createClient } from "@supabase/supabase-js"

const sendInvitationSchema = z.object({
  email: schemas.email,
  founderName: schemas.name,
  invitationToken: schemas.token,
  senderName: z.string().max(255).optional(),
  companyId: schemas.uuid,
})

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting
    const rateLimitKey = getRateLimitKey(request, "send-invitation")
    const rateLimit = checkRateLimit(rateLimitKey, 10, 60000) // 10 per minute
    if (!rateLimit.allowed) {
      return errorResponse(ERROR_MESSAGES.RATE_LIMITED, 429)
    }

    // 2. Authentication
    const { user, error: authError } = await requireAuth()
    if (authError) return authError
    if (!user) return errorResponse(ERROR_MESSAGES.UNAUTHORIZED, 401)

    // 3. Validate input
    const body = await request.json()
    const validation = validateInput(sendInvitationSchema, body)
    if (!validation.success) return validation.error

    const { email, founderName, invitationToken, senderName, companyId } = validation.data

    // 4. Authorization - verify user is a coach in this company
    const { hasAccess } = await requireCompanyAccess(user.id, companyId, "coach")
    if (!hasAccess) {
      return errorResponse(ERROR_MESSAGES.FORBIDDEN, 403)
    }

    // 5. Verify the invitation exists and belongs to this company
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    const { data: invitation } = await adminSupabase
      .from("invitations")
      .select("id, company_id")
      .eq("token", invitationToken)
      .eq("company_id", companyId)
      .eq("status", "pending")
      .single()

    if (!invitation) {
      return errorResponse(ERROR_MESSAGES.NOT_FOUND, 404)
    }

    // 6. Send email
    const postmarkApiKey = process.env.POSTMARK_API_KEY
    if (!postmarkApiKey) {
      console.error("POSTMARK_API_KEY not configured")
      return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
    }

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
      console.error("Postmark API error:", await response.text())
      return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
    }

    const result = await response.json()
    return successResponse({ success: true, messageId: result.MessageID })
  } catch (error) {
    console.error("Email sending error:", error)
    return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
  }
}
