import { createClient } from "@/lib/supabase/server"
import { NextRequest } from "next/server"
import { z } from "zod"
import {
  requireAuth,
  requireCompanyAccess,
  validateInput,
  errorResponse,
  successResponse,
  ERROR_MESSAGES,
  schemas,
} from "@/lib/api-security"

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

const syncSchema = z.object({
  company_id: schemas.uuid.optional(),
  companyId: schemas.uuid.optional(),
}).refine((data) => data.company_id || data.companyId, {
  message: "company_id or companyId is required",
})

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication
    const { user, error: authError } = await requireAuth()
    if (authError) return authError
    if (!user) return errorResponse(ERROR_MESSAGES.UNAUTHORIZED, 401)

    // 2. Validate input
    const body = await request.json()
    const validation = validateInput(syncSchema, body)
    if (!validation.success) return validation.error

    const companyId = validation.data.company_id || validation.data.companyId

    // 3. Authorization - verify user has access to this company (coach only)
    const { hasAccess } = await requireCompanyAccess(user.id, companyId!, "coach")
    if (!hasAccess) {
      return errorResponse(ERROR_MESSAGES.FORBIDDEN, 403)
    }

    const supabase = await createClient()

    // Get calendar connection
    const { data: connection } = await supabase
      .from("google_calendar_connections")
      .select("*")
      .eq("company_id", companyId)
      .single()

    if (!connection) {
      return errorResponse(ERROR_MESSAGES.NOT_FOUND, 404, "No calendar connected")
    }

    // Refresh token if needed
    let accessToken = connection.google_access_token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/tokeninfo?access_token=" + accessToken)
    if (!tokenResponse.ok) {
      const newToken = await refreshAccessToken(connection.google_refresh_token)
      if (!newToken) {
        return errorResponse(ERROR_MESSAGES.UNAUTHORIZED, 401, "Failed to refresh token")
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

    const events = await fetchGoogleCalendarEvents(
      accessToken,
      connection.google_calendar_id,
      timeMin,
      timeMax
    )

    // Get all founder emails from company_members
    const { data: members } = await supabase
      .from("company_members")
      .select("emails")
      .eq("company_id", companyId)
      .eq("role", "founder")

    const founderEmails = new Set<string>()
    members?.forEach((member: Record<string, unknown>) => {
      const emails = member.emails as string[] | undefined
      (emails || []).forEach((email: string) => {
        founderEmails.add(email.toLowerCase())
      })
    })

    // Filter events that include any founder email
    const filteredEvents = events.filter((event) => {
      if (founderEmails.size === 0) {
        return true
      }
      const attendeeEmails = (event.attendees?.map((a) => a.email.toLowerCase()) || [])
      return attendeeEmails.some((email) => founderEmails.has(email))
    })

    // Upsert meetings (only filtered ones)
    const meetingData = filteredEvents.map((event) => ({
      company_id: companyId,
      google_event_id: event.id,
      title: event.summary,
      description: event.description,
      start_time: event.start.dateTime || event.start.date,
      end_time: event.end.dateTime || event.end.date,
      attendee_emails: event.attendees?.map((a) => a.email) || [],
      status: event.status === "cancelled" ? "deleted_in_calendar" : "scheduled",
    }))

    if (meetingData.length > 0) {
      const { error: upsertError } = await supabase.from("meetings").upsert(meetingData, {
        onConflict: "company_id,google_event_id",
      })

      if (upsertError) {
        console.error("Upsert error:", upsertError)
        return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
      }
    }

    // Update last sync time
    const syncTime = new Date().toISOString()
    await supabase
      .from("google_calendar_connections")
      .update({ last_synced_at: syncTime })
      .eq("id", connection.id)

    return successResponse({ success: true, synced: filteredEvents.length })
  } catch (error) {
    console.error("Sync error:", error)
    return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
  }
}
