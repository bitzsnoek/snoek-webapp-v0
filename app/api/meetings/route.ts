// Cache bust: 2024-03-07T12:00:00Z - v3
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  console.log("[v0] Meetings GET endpoint - version 3")
  
  let supabase
  try {
    supabase = await createClient()
  } catch (e) {
    console.error("[v0] Failed to create Supabase client:", e)
    return NextResponse.json({ error: "Database connection failed" }, { status: 500 })
  }

  const companyId = request.nextUrl.searchParams.get("companyId")
  if (!companyId) {
    return NextResponse.json({ error: "Missing companyId" }, { status: 400 })
  }

  try {
    // Check if calendar is connected
    const { data: connection } = await supabase
      .from("google_calendar_connections")
      .select("id, google_calendar_id, last_synced_at")
      .eq("company_id", companyId)
      .single()

    // Fetch meetings
    const { data: meetings, error } = await supabase
      .from("meetings")
      .select("*")
      .eq("company_id", companyId)
      .order("start_time", { ascending: false })

    if (error) {
      console.error("[v0] Meetings query error:", error)
      throw error
    }

    console.log("[v0] v3 - Fetched", meetings?.length || 0, "meetings, hasConnection:", !!connection)

    return NextResponse.json({
      meetings: meetings || [],
      hasConnection: !!connection,
      connectedCalendar: connection?.google_calendar_id || null,
      lastSyncedAt: connection?.last_synced_at || null,
    })
  } catch (error) {
    console.error("[v0] Failed to fetch meetings:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
