import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { token, email, password, name } = await request.json()

    if (!token || !email || !password || !name?.trim()) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 8 characters" },
        { status: 400 }
      )
    }

    // Verify environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase environment variables")
      return NextResponse.json(
        { success: false, error: "Server configuration error. Please contact support." },
        { status: 500 }
      )
    }

    // Check if it looks like a service role key (should contain 'service_role' or be different from anon key)
    const isLikelyServiceKey = serviceRoleKey.length > 100 && serviceRoleKey !== process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!isLikelyServiceKey) {
      console.error("SUPABASE_SERVICE_ROLE_KEY appears to be invalid or same as anon key")
    }

    // Use service role client to bypass RLS
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

    // 1. Validate the invitation
    const { data: invitation, error: getError } = await adminSupabase
      .from("invitations")
      .select("*")
      .eq("token", token)
      .eq("status", "pending")
      .single()

    if (getError || !invitation) {
      return NextResponse.json(
        { success: false, error: "Invitation not found or already used" },
        { status: 404 }
      )
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: "Invitation has expired" },
        { status: 410 }
      )
    }

    // Verify the email matches the invitation
    if (invitation.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: `This invitation was sent to ${invitation.email}. Please use that email address.` },
        { status: 400 }
      )
    }

    // 2. Create the user using admin API (no confirmation email sent)
    let userId: string

    const { data: createData, error: createError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Mark email as confirmed immediately
      user_metadata: { full_name: name.trim() },
    })

    if (createError) {
      const errorMsg = createError.message || createError.name || JSON.stringify(createError)
      console.error("Create user error:", createError)
      
      // Check if the error is because user already exists
      if (errorMsg?.includes("already been registered") || 
          errorMsg?.includes("already exists") ||
          errorMsg?.includes("User already registered") ||
          errorMsg?.includes("duplicate key") ||
          errorMsg?.includes("unique constraint")) {
        return NextResponse.json(
          { success: false, error: "This email is already registered. Please log in and accept the invitation from your dashboard." },
          { status: 400 }
        )
      }

      // Check for service role key issues - if admin API fails, the service role key may be wrong
      if (errorMsg?.includes("Bearer token") || errorMsg?.includes("invalid JWT") || errorMsg?.includes("not authorized")) {
        console.error("Service role key issue detected. The SUPABASE_SERVICE_ROLE_KEY may be incorrect.")
        console.error("Key starts with:", serviceRoleKey.substring(0, 30))
        
        // Return a clear error - don't use signUp fallback as it will timeout
        return NextResponse.json(
          { success: false, error: "Server configuration error: Invalid service key. Please contact support." },
          { status: 500 }
        )
      } else {
        return NextResponse.json(
          { success: false, error: `Failed to create account: ${errorMsg}` },
          { status: 500 }
        )
      }
    } else if (!createData?.user) {
      return NextResponse.json(
        { success: false, error: "Failed to create account. Please try again." },
        { status: 500 }
      )
    } else {
      userId = createData.user.id
    }

    // 3. Ensure profile exists
    const displayName = name.trim()
    await adminSupabase
      .from("profiles")
      .upsert({ id: userId, full_name: displayName }, { onConflict: "id" })

    // 4. Link user to company
    const { data: alreadyMember } = await adminSupabase
      .from("company_members")
      .select("id")
      .eq("company_id", invitation.company_id)
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle()

    if (!alreadyMember) {
      if (invitation.member_id) {
        // Link to the specific member row and update name
        // First check if the member exists and its current state
        const { data: existingMember, error: fetchMemberError } = await adminSupabase
          .from("company_members")
          .select("id, user_id, name")
          .eq("id", invitation.member_id)
          .single()

        if (existingMember?.user_id && existingMember.user_id !== userId) {
          // Member already linked to a different user
          return NextResponse.json(
            { success: false, error: "This invitation has already been used by another account" },
            { status: 400 }
          )
        }

        if (existingMember && !existingMember.user_id) {
          // Member exists but not linked, proceed with linking
          const { error: linkError, count } = await adminSupabase
            .from("company_members")
            .update({ user_id: userId, name: displayName })
            .eq("id", invitation.member_id)
            .is("user_id", null)

          if (linkError) {
            console.error("Link member error:", linkError)
            return NextResponse.json(
              { success: false, error: "Failed to link you to the company" },
              { status: 500 }
            )
          }
        } else if (existingMember?.user_id === userId) {
          // Already linked to this user, nothing to do
        } else if (!existingMember) {
          // Member doesn't exist, create new one
          const { error: memberError } = await adminSupabase
            .from("company_members")
            .insert({
              company_id: invitation.company_id,
              user_id: userId,
              role: invitation.role,
              name: displayName,
            })

          if (memberError) {
            console.error("Create member error:", memberError)
            return NextResponse.json(
              { success: false, error: "Failed to add you to the company" },
              { status: 500 }
            )
          }
        }
      } else {
        // Create a new company member
        const { error: memberError } = await adminSupabase
          .from("company_members")
          .insert({
            company_id: invitation.company_id,
            user_id: userId,
            role: invitation.role,
            name: displayName,
          })

        if (memberError) {
          console.error("Create member error:", memberError)
          return NextResponse.json(
            { success: false, error: "Failed to add you to the company" },
            { status: 500 }
          )
        }
      }
    }

    // 5. Mark invitation as accepted
    await adminSupabase
      .from("invitations")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", invitation.id)

    return NextResponse.json({
      success: true,
      companyId: invitation.company_id,
    })
  } catch (err) {
    console.error("Accept invitation with signup error:", err)
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred" },
      { status: 500 }
    )
  }
}
