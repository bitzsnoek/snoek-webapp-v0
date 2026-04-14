import { createClient } from "@/lib/supabase/server"
import { NextRequest } from "next/server"
import {
  requireAuth,
  requireClientAccess,
  validateInput,
  errorResponse,
  successResponse,
  ERROR_MESSAGES,
  schemas,
} from "@/lib/api-security"

export async function GET(request: NextRequest) {
  try {
    // 1. Authentication
    const { user, error: authError } = await requireAuth()
    if (authError) return authError
    if (!user) return errorResponse(ERROR_MESSAGES.UNAUTHORIZED, 401)

    const clientId = request.nextUrl.searchParams.get("clientId")

    // 2. Validate clientId
    if (!clientId) {
      return errorResponse(ERROR_MESSAGES.BAD_REQUEST, 400, "Missing clientId")
    }

    const validation = validateInput(schemas.uuid, clientId)
    if (!validation.success) return validation.error

    // 3. Authorization - verify user has access to this client
    const { hasAccess } = await requireClientAccess(user.id, clientId)
    if (!hasAccess) {
      return errorResponse(ERROR_MESSAGES.FORBIDDEN, 403)
    }

    const supabase = await createClient()

    // Check if calendar is connected and get calendar details
    const { data: connection } = await supabase
      .from("google_calendar_connections")
      .select("id, google_calendar_id, last_synced_at")
      .eq("client_id", clientId)
      .single()

    // Fetch meetings with document types
    const { data: rawMeetings, error } = await supabase
      .from("meetings")
      .select("*, meeting_documents(id, document_type)")
      .eq("client_id", clientId)
      .order("start_time", { ascending: false })

    if (error) throw error

    // Transform snake_case to camelCase for frontend
    const meetings = (rawMeetings || []).map((m: Record<string, unknown>) => {
      const docs = (m.meeting_documents || []) as Array<{ id: string; document_type: string }>
      const transcriptCount = docs.filter((d) => d.document_type === "transcript").length
      const notesCount = docs.filter((d) => d.document_type === "notes").length
      const otherCount = docs.filter((d) => d.document_type === "other" || !d.document_type).length
      
      return {
        id: m.id,
        title: m.title || "Untitled Meeting",
        description: m.description,
        startTime: m.start_time,
        endTime: m.end_time,
        attendeeEmails: m.attendee_emails || [],
        memberIds: [],
        hasDocuments: docs.length > 0,
        documentCount: docs.length,
        transcriptCount,
        notesCount,
        otherCount,
        status: m.status || "scheduled",
      }
    })

    return successResponse({
      meetings,
      hasConnection: !!connection,
      connectedCalendar: connection?.google_calendar_id || null,
      lastSyncedAt: connection?.last_synced_at || null,
    })
  } catch (error) {
    console.error("Failed to fetch meetings:", error)
    return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
  }
}
