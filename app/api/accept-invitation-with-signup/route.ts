import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { token, email, password } = await request.json()

    if (!token || !email || !password) {
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
      process.env.SUPABASE_SERVICE_ROLE_KEY!
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

    // 2. Create or get the user
    // First check if user already exists
    const { data: existingUsers } = await adminSupabase.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    )

    let userId: string

    if (existingUser) {
      // User exists -- update their password and confirm email
      const { error: updateError } = await adminSupabase.auth.admin.updateUserById(
        existingUser.id,
        { password, email_confirm: true }
      )
      if (updateError) {
        console.error("Update user error:", updateError)
        return NextResponse.json(
          { success: false, error: "Failed to update account. Please try again." },
          { status: 500 }
        )
      }
      userId = existingUser.id
    } else {
      // Create new user with confirmed email
      const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (createError || !newUser.user) {
        console.error("Create user error:", createError)
        return NextResponse.json(
          { success: false, error: "Failed to create account. Please try again." },
          { status: 500 }
        )
      }
      userId = newUser.user.id
    }

    // 3. Ensure profile exists
    await adminSupabase
      .from("profiles")
      .upsert({ id: userId, full_name: email.split("@")[0] }, { onConflict: "id" })

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
        // Link to the specific member row
        const { error: linkError } = await adminSupabase
          .from("company_members")
          .update({ user_id: userId })
          .eq("id", invitation.member_id)
          .is("user_id", null)

        if (linkError) {
          console.error("Link member error:", linkError)
          return NextResponse.json(
            { success: false, error: "Failed to link you to the company" },
            { status: 500 }
          )
        }
      } else {
        // Create a new company member
        const { error: memberError } = await adminSupabase
          .from("company_members")
          .insert({
            company_id: invitation.company_id,
            user_id: userId,
            role: invitation.role,
            name: email.split("@")[0],
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
