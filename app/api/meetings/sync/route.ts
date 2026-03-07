import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

interface GoogleEvent {
  id: string
  summary: string
  description?: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  attendees?: Array<{ email: string }>
  status: string
}

async function refreshAccessToken(
  refreshToken: string
): Promise<string | null> {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }).toString(),
    })

    if (!response.ok) return null
    const { access_token } = await response.json()
    return access_token
  } catch {
    return null
  }
}

async function fetchGoogleCalendarEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<GoogleEvent[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
  })

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!response.ok) return []
  const data = await response.json()
  return data.items || []
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { company_id } = await request.json()

  console.log("[v0] Sync POST request for company:", company_id)

  if (!company_id) {
    return NextResponse.json({ error: "Missing company_id" }, { status: 400 })
  }

  try {
    // Get calendar connection
    const { data: connection } = await supabase
      .from("google_calendar_connections")
      .select("*")
      .eq("company_id", company_id)
      .single()

    console.log("[v0] Calendar connection found:", !!connection)

    if (!connection) {
      return NextResponse.json({ error: "No calendar connected" }, { status: 404 })
    }

    // Refresh token if needed
    let accessToken = connection.google_access_token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/tokeninfo?access_token=" + accessToken)
    if (!tokenResponse.ok) {
      console.log("[v0] Token expired, refreshing...")
      const newToken = await refreshAccessToken(connection.google_refresh_token)
      if (!newToken) {
        return NextResponse.json({ error: "Failed to refresh token" }, { status: 401 })
      }
      accessToken = newToken
      // Update in DB
      await supabase
        .from("google_calendar_connections")
        .update({ google_access_token: newToken })
        .eq("id", connection.id)
    }

    // Fetch events from Google Calendar
    const now = new Date()
    const timeMin = new Date(now.getTime() - 3 * 30 * 24 * 60 * 60 * 1000).toISOString() // 3 months ago
    const timeMax = new Date(now.getTime() + 3 * 30 * 24 * 60 * 60 * 1000).toISOString() // 3 months ahead
    console.log("[v0] Fetching events from", timeMin, "to", timeMax)

    const events = await fetchGoogleCalendarEvents(
      accessToken,
      connection.google_calendar_id,
      timeMin,
      timeMax
    )
    console.log("[v0] Fetched", events.length, "events from Google Calendar")

    // Get all founder emails from company_members
    const { data: members } = await supabase
      .from("company_members")
      .select("emails")
      .eq("company_id", company_id)
      .eq("role", "founder")

    const founderEmails = new Set<string>()
    members?.forEach((member: any) => {
      (member.emails || []).forEach((email: string) => {
        founderEmails.add(email.toLowerCase())
        console.log("[v0] Added founder email:", email)
      })
    })
    console.log("[v0] Found", founderEmails.size, "founder emails:", Array.from(founderEmails))

    // Filter events that include any founder email
    const filteredEvents = events.filter((event) => {
      if (founderEmails.size === 0) {
        console.log("[v0] No founder emails configured, including event:", event.summary)
        return true
      }
      const attendeeEmails = (event.attendees?.map((a) => a.email.toLowerCase()) || [])
      const matches = attendeeEmails.some((email) => founderEmails.has(email))
      console.log("[v0] Event:", event.summary, "attendees:", attendeeEmails, "matches:", matches)
      return matches
    })
    console.log("[v0] Filtered to", filteredEvents.length, "events matching founders")

    // Upsert meetings (only filtered ones)
    const meetingData = filteredEvents.map((event) => ({
      company_id,
      google_event_id: event.id,
      title: event.summary,
      description: event.description,
      start_time: event.start.dateTime || event.start.date,
      end_time: event.end.dateTime || event.end.date,
      attendee_emails: event.attendees?.map((a) => a.email) || [],
      status: event.status === "cancelled" ? "deleted_in_calendar" : "scheduled",
    }))

    if (meetingData.length > 0) {
      console.log("[v0] Upserting", meetingData.length, "meetings")
      const { error: upsertError } = await supabase.from("meetings").upsert(meetingData, {
        onConflict: "company_id,google_event_id",
      })

      if (upsertError) {
        console.error("[v0] Upsert error:", upsertError)
        throw new Error("Failed to save meetings")
      }
      console.log("[v0] Upsert successful")
    }

    // Update last sync time
    const syncTime = new Date().toISOString()
    await supabase
      .from("google_calendar_connections")
      .update({ last_synced_at: syncTime })
      .eq("id", connection.id)
    
    console.log("[v0] Sync completed successfully, synced:", filteredEvents.length, "meetings")
    return NextResponse.json({ success: true, synced: filteredEvents.length })
  } catch (error) {
    console.error("[v0] Sync error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
