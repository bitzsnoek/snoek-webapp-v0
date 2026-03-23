import { createClient } from "@supabase/supabase-js"
import { NextRequest } from "next/server"
import {
  checkRateLimit,
  getRateLimitKey,
  validateInput,
  errorResponse,
  successResponse,
  ERROR_MESSAGES,
  schemas,
} from "@/lib/api-security"

export async function GET(request: NextRequest) {
  try {
    // 1. Rate limiting
    const rateLimitKey = getRateLimitKey(request, "invitation-details")
    const rateLimit = checkRateLimit(rateLimitKey, 20, 60000) // 20 per minute
    if (!rateLimit.allowed) {
      return errorResponse(ERROR_MESSAGES.RATE_LIMITED, 429)
    }

    const token = request.nextUrl.searchParams.get("token")

    // 2. Validate token
    if (!token) {
      return errorResponse(ERROR_MESSAGES.BAD_REQUEST, 400, "Missing token")
    }

    const validation = validateInput(schemas.token, token)
    if (!validation.success) return validation.error

    // 3. Get invitation details
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: invitation, error } = await adminSupabase
      .from("invitations")
      .select("email, company_id, status, expires_at")
      .eq("token", token)
      .single()

    if (error || !invitation) {
      return errorResponse(ERROR_MESSAGES.NOT_FOUND, 404)
    }

    if (invitation.status !== "pending") {
      return errorResponse("This invitation has already been used", 400)
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return errorResponse("This invitation has expired. Please ask for a new one.", 410)
    }

    // Get company name
    const { data: company } = await adminSupabase
      .from("companies")
      .select("name")
      .eq("id", invitation.company_id)
      .single()

    return successResponse({
      email: invitation.email,
      companyName: company?.name || null,
    })
  } catch (err) {
    console.error("Invitation details error:", err)
    return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
  }
}
