import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const companyId = request.nextUrl.searchParams.get("companyId")

  if (!companyId) {
    return NextResponse.json({ error: "Missing companyId" }, { status: 400 })
  }

  try {
    // Check if calendar is connected
    const { data: connection } = await supabase
      .from("google_calendar_connections")
      .select("id")
      .eq("company_id", companyId)
      .single()

    // Fetch meetings
    const { data: meetings, error } = await supabase
      .from("meetings")
      .select("*")
      .eq("company_id", companyId)
      .order("start_time", { ascending: false })

    if (error) throw error

    return NextResponse.json({
      meetings: meetings || [],
      hasConnection: !!connection,
    })
  } catch (error) {
    console.error("Failed to fetch meetings:", error)
    return NextResponse.json({ error: "Failed to fetch meetings" }, { status: 500 })
  }
}
