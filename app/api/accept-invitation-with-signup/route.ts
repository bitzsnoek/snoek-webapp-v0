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

    // Use service role client to bypass RLS
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
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

      // Check for service role key issues
      if (errorMsg?.includes("Bearer token") || errorMsg?.includes("invalid JWT") || errorMsg?.includes("not authorized")) {
        console.error("Service role key issue - attempting signUp fallback")
        // Fallback to signUp if admin API fails due to permissions
        const { data: signUpData, error: signUpError } = await adminSupabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name.trim() },
          },
        })

        if (signUpError) {
          return NextResponse.json(
            { success: false, error: `Failed to create account: ${signUpError.message || 'Unknown error'}` },
            { status: 500 }
          )
        }

        if (!signUpData.user || (signUpData.user.identities && signUpData.user.identities.length === 0)) {
          return NextResponse.json(
            { success: false, error: "This email is already registered. Please log in and accept the invitation from your dashboard." },
            { status: 400 }
          )
        }

        userId = signUpData.user.id
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
