import { createClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { NextRequest } from "next/server"
import { z } from "zod"
import {
  validateInput,
  errorResponse,
  successResponse,
  ERROR_MESSAGES,
  schemas,
} from "@/lib/api-security"

const acceptInvitationSchema = z.object({
  token: schemas.token,
})

export async function POST(request: NextRequest) {
  try {
    // 1. Validate input
    const body = await request.json()
    const validation = validateInput(acceptInvitationSchema, body)
    if (!validation.success) return validation.error

    const { token } = validation.data

    // 2. Verify the user is authenticated via the regular server client
    const serverSupabase = await createServerClient()
    const { data: { user } } = await serverSupabase.auth.getUser()

    if (!user) {
      return errorResponse(ERROR_MESSAGES.UNAUTHORIZED, 401)
    }

    // 3. Use service role client to bypass RLS for reading/writing invitations
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 4. Get the invitation (bypasses RLS)
    const { data: invitation, error: getError } = await adminSupabase
      .from("invitations")
      .select("*")
      .eq("token", token)
      .eq("status", "pending")
      .single()

    if (getError || !invitation) {
      return errorResponse(ERROR_MESSAGES.NOT_FOUND, 404, "Invitation not found or already used")
    }

    // 5. Check expiry
    if (new Date(invitation.expires_at) < new Date()) {
      return errorResponse("Invitation has expired", 410)
    }

    // 6. Check if user is already a member of this client
    const { data: alreadyMember } = await adminSupabase
      .from("client_members")
      .select("id")
      .eq("client_id", invitation.client_id)
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle()

    if (!alreadyMember) {
      if (invitation.member_id) {
        // Invitation is linked to a specific member -- connect the user to that member
        const { error: linkError } = await adminSupabase
          .from("client_members")
          .update({ user_id: user.id })
          .eq("id", invitation.member_id)
          .is("user_id", null)

        if (linkError) {
          console.error("Accept invitation link error:", linkError)
          return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
        }
      } else {
        // No specific member linked -- create a new client member
        const nameFromEmail = user.user_metadata?.full_name || invitation.email.split("@")[0]
        const { error: memberError } = await adminSupabase
          .from("client_members")
          .insert({
            client_id: invitation.client_id,
            user_id: user.id,
            role: invitation.role,
            name: nameFromEmail,
          })

        if (memberError) {
          console.error("Accept invitation member error:", memberError)
          return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
        }
      }
    }

    // 7. Mark invitation as accepted
    await adminSupabase
      .from("invitations")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", invitation.id)

    return successResponse({
      success: true,
      clientId: invitation.client_id,
    })
  } catch (err) {
    console.error("Accept invitation error:", err)
    return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
  }
}
