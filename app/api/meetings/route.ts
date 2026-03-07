import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// v2 - Fixed await createClient
export async function GET(request: NextRequest) {
  try {
    console.log("[v0] Meetings GET - v2")
    const supabase = await createClient()
    console.log("[v0] Supabase client created successfully")
    
    const companyId = request.nextUrl.searchParams.get("companyId")
    if (!companyId) {
      return NextResponse.json({ error: "Missing companyId" }, { status: 400 })
    }

    // Check if calendar is connected and get calendar details
    const { data: connection, error: connError } = await supabase
      .from("google_calendar_connections")
      .select("id, google_calendar_id, last_synced_at")
      .eq("company_id", companyId)
      .single()

    if (connError && connError.code !== "PGRST116") {
      console.log("[v0] Connection query error:", connError)
    }

    // Fetch meetings
    const { data: meetings, error } = await supabase
      .from("meetings")
      .select("*")
      .eq("company_id", companyId)
      .order("start_time", { ascending: false })

    if (error) {
      console.log("[v0] Meetings query error:", error)
      throw error
    }

    console.log("[v0] Fetched", meetings?.length || 0, "meetings")

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
