import { createClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()

    if (!token) {
      return NextResponse.json({ success: false, error: "Missing token" }, { status: 400 })
    }

    // Verify the user is authenticated via the regular server client
    const serverSupabase = await createServerClient()
    const { data: { user } } = await serverSupabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 })
    }

    // Use service role client to bypass RLS for reading/writing invitations
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get the invitation (bypasses RLS)
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

    // Check expiry
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: "Invitation has expired" },
        { status: 410 }
      )
    }

    // Check if user is already a member of this company
    const { data: alreadyMember } = await adminSupabase
      .from("company_members")
      .select("id")
      .eq("company_id", invitation.company_id)
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle()

    if (!alreadyMember) {
      // Check if an unconnected founder with matching name exists
      const nameFromEmail = invitation.email.split("@")[0]
      const { data: existingMember } = await adminSupabase
        .from("company_members")
        .select("id")
        .eq("company_id", invitation.company_id)
        .is("user_id", null)
        .ilike("name", nameFromEmail)
        .maybeSingle()

      if (existingMember) {
        // Link the auth user to the existing unconnected founder
        const { error: linkError } = await adminSupabase
          .from("company_members")
          .update({ user_id: user.id })
          .eq("id", existingMember.id)

        if (linkError) {
          console.error("Accept invitation link error:", linkError)
          return NextResponse.json(
            { success: false, error: "Failed to link user to founder" },
            { status: 500 }
          )
        }
      } else {
        // Create a new company member
        const { error: memberError } = await adminSupabase
          .from("company_members")
          .insert({
            company_id: invitation.company_id,
            user_id: user.id,
            role: invitation.role,
            name: nameFromEmail,
          })

        if (memberError) {
          console.error("Accept invitation member error:", memberError)
          return NextResponse.json(
            { success: false, error: "Failed to add user to company" },
            { status: 500 }
          )
        }
      }
    }

    // Mark invitation as accepted
    await adminSupabase
      .from("invitations")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", invitation.id)

    return NextResponse.json({
      success: true,
      companyId: invitation.company_id,
    })
  } catch (err) {
    console.error("Accept invitation error:", err)
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred" },
      { status: 500 }
    )
  }
}
