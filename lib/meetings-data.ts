import { createClient } from "@/lib/supabase/client"

export interface Meeting {
  id: string
  client_id: string
  title: string
  description?: string
  start_time: string
  end_time: string
  attendee_emails: string[]
  member_ids: string[]
  status: "scheduled" | "deleted_in_calendar" | "rescheduled"
  has_documents: boolean
  documents_count?: number
}

export interface MeetingDocument {
  id: string
  meeting_id: string
  title: string
  content: string
  document_type: "transcript" | "notes" | "other"
  embedding?: number[]
  created_at: string
}

export async function fetchMeetings(clientId: string): Promise<Meeting[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("meetings")
    .select(
      `
      *,
      meeting_documents:meeting_documents(id)
    `
    )
    .eq("client_id", clientId)
    .order("start_time", { ascending: false })

  if (error) {
    console.error("fetchMeetings error:", error)
    return []
  }

  return (data || []).map((m: any) => ({
    ...m,
    documents_count: m.meeting_documents?.length || 0,
  }))
}

export async function fetchMeetingDetails(meetingId: string): Promise<(Meeting & { documents: MeetingDocument[] }) | null> {
  const supabase = createClient()
  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", meetingId)
    .single()

  if (meetingError || !meeting) return null

  const { data: documents, error: docsError } = await supabase
    .from("meeting_documents")
    .select("*")
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: false })

  if (docsError) documents = []

  return { ...meeting, documents: documents || [] }
}

export async function uploadMeetingDocument(
  meetingId: string,
  title: string,
  content: string,
  documentType: "transcript" | "notes" | "other" = "notes"
): Promise<MeetingDocument | null> {
  const supabase = createClient()

  // TODO: Generate embedding using OpenAI or similar
  // For now, skip embedding - can be added later

  const { data, error } = await supabase
    .from("meeting_documents")
    .insert({ meeting_id: meetingId, title, content, document_type: documentType })
    .select()
    .single()

  if (error) {
    console.error("uploadMeetingDocument error:", error)
    return null
  }

  // Mark meeting as having documents
  await supabase.from("meetings").update({ has_documents: true }).eq("id", meetingId)

  return data
}

export async function deleteMeetingDocument(documentId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from("meeting_documents").delete().eq("id", documentId)

  if (error) {
    console.error("deleteMeetingDocument error:", error)
    return false
  }

  return true
}

export async function manualSyncMeetings(clientId: string): Promise<{ success: boolean; synced?: number }> {
  try {
    const response = await fetch("/api/meetings/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId }),
    })

    if (!response.ok) return { success: false }
    const result = await response.json()
    return { success: true, synced: result.synced }
  } catch (error) {
    console.error("manualSyncMeetings error:", error)
    return { success: false }
  }
}
