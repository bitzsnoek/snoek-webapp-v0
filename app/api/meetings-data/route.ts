// New route to bypass caching - 2026-03-07
import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const companyId = request.nextUrl.searchParams.get("companyId")

    if (!companyId) {
      return NextResponse.json({ error: "Missing companyId" }, { status: 400 })
    }

    // Check if calendar is connected and get calendar details
    const { data: connection } = await supabase
      .from("google_calendar_connections")
      .select("id, google_calendar_id, last_synced_at")
      .eq("company_id", companyId)
      .single()

    // Fetch meetings with document count
    const { data: rawMeetings, error } = await supabase
      .from("meetings")
      .select("*, meeting_documents(id)")
      .eq("company_id", companyId)
      .order("start_time", { ascending: false })

    if (error) throw error

    // Transform snake_case to camelCase for frontend
    const meetings = (rawMeetings || []).map((m: any) => ({
      id: m.id,
      title: m.title || "Untitled Meeting",
      description: m.description,
      startTime: m.start_time,
      endTime: m.end_time,
      attendeeEmails: m.attendee_emails || [],
      founderIds: [],
      hasDocuments: (m.meeting_documents?.length || 0) > 0,
      documentCount: m.meeting_documents?.length || 0,
      status: m.status || "scheduled",
    }))

    return NextResponse.json({
      meetings,
      hasConnection: !!connection,
      connectedCalendar: connection?.google_calendar_id || null,
      lastSyncedAt: connection?.last_synced_at || null,
    })
  } catch (error) {
    console.error("Failed to fetch meetings:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
