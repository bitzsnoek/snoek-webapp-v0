import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  requireAuth,
  requireCompanyAccess,
  validateInput,
  errorResponse,
  ERROR_MESSAGES,
  schemas,
} from "@/lib/api-security"

const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ")

const connectSchema = z.object({
  company_id: schemas.uuid,
})

export async function GET(request: NextRequest) {
  try {
    // 1. Authentication
    const { user, error: authError } = await requireAuth()
    if (authError) return authError
    if (!user) return errorResponse(ERROR_MESSAGES.UNAUTHORIZED, 401)

    // 2. Validate input
    const companyId = request.nextUrl.searchParams.get("company_id")
    const validation = validateInput(connectSchema, { company_id: companyId })
    if (!validation.success) return validation.error

    // 3. Authorization - verify user is a coach in this company
    const { hasAccess } = await requireCompanyAccess(user.id, validation.data.company_id, "coach")
    if (!hasAccess) {
      return errorResponse(ERROR_MESSAGES.FORBIDDEN, 403)
    }

    // 4. Check configuration
    const clientId = process.env.GOOGLE_CLIENT_ID
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (!clientId || !appUrl) {
      console.error("Google OAuth not configured")
      return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
    }

    // 5. Build OAuth URL
    const redirectUri = `${appUrl}/api/google-calendar/callback`
    const state = JSON.stringify({ company_id: validation.data.company_id, user_id: user.id })

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: GOOGLE_OAUTH_SCOPES,
      state,
      access_type: "offline",
      prompt: "consent",
    })

    return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
  } catch (error) {
    console.error("Google Calendar connect error:", error)
    return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
  }
}
