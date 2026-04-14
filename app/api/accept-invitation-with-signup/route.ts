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

const signupSchema = z.object({
  token: schemas.token,
  email: schemas.email,
  password: schemas.password,
  name: schemas.name,
})

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting - strict for signup endpoints
    const rateLimitKey = getRateLimitKey(request, "signup")
    const rateLimit = checkRateLimit(rateLimitKey, 5, 300000) // 5 per 5 minutes
    if (!rateLimit.allowed) {
      return errorResponse(ERROR_MESSAGES.RATE_LIMITED, 429)
    }

    // 2. Validate input
    const body = await request.json()
    const validation = validateInput(signupSchema, body)
    if (!validation.success) return validation.error

    const { token, email, password, name } = validation.data

    // 3. Verify environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase environment variables")
      return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
    }

    // 4. Use service role client to bypass RLS
    const adminSupabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      { 
        auth: { 
          autoRefreshToken: false, 
          persistSession: false 
        },
        global: {
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`
          }
        }
      }
    )

    // 5. Validate the invitation
    const { data: invitation, error: getError } = await adminSupabase
      .from("invitations")
      .select("*")
      .eq("token", token)
      .eq("status", "pending")
      .single()

    if (getError || !invitation) {
      return errorResponse(ERROR_MESSAGES.NOT_FOUND, 404, "Invitation not found or already used")
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return errorResponse("Invitation has expired", 410)
    }

    // 6. Verify the email matches the invitation
    if (invitation.email.toLowerCase() !== email.toLowerCase()) {
      return errorResponse(ERROR_MESSAGES.BAD_REQUEST, 400, "Email does not match invitation")
    }

    // 7. Create the user using admin API (no confirmation email sent)
    let userId: string

    const { data: createData, error: createError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Mark email as confirmed immediately
      user_metadata: { full_name: name },
    })

    if (createError) {
      const errorMsg = createError.message || ""
      console.error("Create user error:", createError)
      
      // Check if the error is because user already exists
      if (errorMsg.includes("already been registered") || 
          errorMsg.includes("already exists") ||
          errorMsg.includes("User already registered") ||
          errorMsg.includes("duplicate key") ||
          errorMsg.includes("unique constraint")) {
        return errorResponse(ERROR_MESSAGES.BAD_REQUEST, 400, "Email already registered")
      }

      // Check for service role key issues
      if (errorMsg.includes("Bearer token") || errorMsg.includes("invalid JWT") || errorMsg.includes("not authorized")) {
        console.error("Service role key issue detected")
        return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
      }

      return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
    }
    
    if (!createData?.user) {
      return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
    }
    
    userId = createData.user.id

    // 8. Ensure profile exists
    await adminSupabase
      .from("profiles")
      .upsert({ id: userId, full_name: name }, { onConflict: "id" })

    // 9. Link user to client
    const { data: alreadyMember } = await adminSupabase
      .from("client_members")
      .select("id")
      .eq("client_id", invitation.client_id)
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle()

    if (!alreadyMember) {
      if (invitation.member_id) {
        // Link to the specific member row and update name
        const { data: existingMember } = await adminSupabase
          .from("client_members")
          .select("id, user_id, name")
          .eq("id", invitation.member_id)
          .single()

        if (existingMember?.user_id && existingMember.user_id !== userId) {
          // Member already linked to a different user
          return errorResponse(ERROR_MESSAGES.BAD_REQUEST, 400, "Invitation already used")
        }

        if (existingMember && !existingMember.user_id) {
          // Member exists but not linked, proceed with linking
          const { error: linkError } = await adminSupabase
            .from("client_members")
            .update({ user_id: userId, name })
            .eq("id", invitation.member_id)
            .is("user_id", null)

          if (linkError) {
            console.error("Link member error:", linkError)
            return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
          }
        } else if (!existingMember) {
          // Member doesn't exist, create new one
          const { error: memberError } = await adminSupabase
            .from("client_members")
            .insert({
              client_id: invitation.client_id,
              user_id: userId,
              role: invitation.role,
              name,
            })

          if (memberError) {
            console.error("Create member error:", memberError)
            return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
          }
        }
      } else {
        // Create a new client member
        const { error: memberError } = await adminSupabase
          .from("client_members")
          .insert({
            client_id: invitation.client_id,
            user_id: userId,
            role: invitation.role,
            name,
          })

        if (memberError) {
          console.error("Create member error:", memberError)
          return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
        }
      }
    }

    // 10. Mark invitation as accepted
    await adminSupabase
      .from("invitations")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", invitation.id)

    return successResponse({
      success: true,
      clientId: invitation.client_id,
    })
  } catch (err) {
    console.error("Accept invitation with signup error:", err)
    return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
  }
}
