import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token")

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 })
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    console.log("[v0] Looking up invitation with token:", token)
    
    const { data: invitation, error } = await adminSupabase
      .from("invitations")
      .select("email, company_id, status, expires_at")
      .eq("token", token)
      .single()

    console.log("[v0] Invitation lookup result:", { invitation, error })

    if (error || !invitation) {
      // Also try to find any invitation with similar token to debug
      const { data: allInvitations } = await adminSupabase
        .from("invitations")
        .select("id, token, email, status")
        .eq("email", "stef+31@bitzsnoek.nl")
      console.log("[v0] Invitations for stef+31@bitzsnoek.nl:", allInvitations)
      
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      )
    }

    if (invitation.status !== "pending") {
      return NextResponse.json(
        { error: "This invitation has already been used" },
        { status: 400 }
      )
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "This invitation has expired. Please ask for a new one." },
        { status: 410 }
      )
    }

    // Get company name
    const { data: company } = await adminSupabase
      .from("companies")
      .select("name")
      .eq("id", invitation.company_id)
      .single()

    return NextResponse.json({
      email: invitation.email,
      companyName: company?.name || null,
    })
  } catch (err) {
    console.error("Invitation details error:", err)
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    )
  }
}
