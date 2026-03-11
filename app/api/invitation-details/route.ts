import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token")

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    console.log("[v0] Supabase URL exists:", !!supabaseUrl)
    console.log("[v0] Service Role Key exists:", !!serviceRoleKey)
    console.log("[v0] Service Role Key starts with:", serviceRoleKey?.substring(0, 20))
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[v0] Missing Supabase credentials")
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      )
    }
    
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log("[v0] Looking up invitation with token:", token)
    
    const { data: invitation, error } = await adminSupabase
      .from("invitations")
      .select("email, company_id, status, expires_at")
      .eq("token", token)
      .single()

    console.log("[v0] Invitation lookup result:", JSON.stringify({ invitation, error }, null, 2))

    if (error || !invitation) {
      console.log("[v0] Error code:", error?.code)
      console.log("[v0] Error message:", error?.message)
      console.log("[v0] Error details:", error?.details)
      console.log("[v0] Error hint:", error?.hint)
      
      return NextResponse.json(
        { error: "Invitation not found", debug: { errorCode: error?.code, errorMessage: error?.message } },
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
