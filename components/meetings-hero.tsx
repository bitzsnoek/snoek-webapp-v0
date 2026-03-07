"use client"

import { useState } from "react"
import type { Meeting } from "@/lib/mock-data"
import { MeetingDetailModal } from "./meeting-detail-modal"
import { format } from "date-fns"
import { Calendar, FileText } from "lucide-react"

interface MeetingsHeroProps {
  meetings: Meeting[]
}

export default function MeetingsHero({ meetings }: MeetingsHeroProps) {
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const now = new Date()

  // Separate past and future meetings
  const past = meetings.filter((m) => new Date(m.endTime) < now).sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime()).slice(0, 2)
  const future = meetings.filter((m) => new Date(m.startTime) >= now).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()).slice(0, 2)

  function openMeetingDetail(meeting: Meeting) {
    setSelectedMeeting(meeting)
    setModalOpen(true)
  }

  if (past.length === 0 && future.length === 0) return null

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Last 2 Meetings */}
        {past.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Recent Meetings</h3>
            {past.map((meeting) => (
              <MeetingCard key={meeting.id} meeting={meeting} onClick={() => openMeetingDetail(meeting)} />
            ))}
          </div>
        )}

        {/* Next 2 Meetings */}
        {future.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Upcoming Meetings</h3>
            {future.map((meeting) => (
              <MeetingCard key={meeting.id} meeting={meeting} onClick={() => openMeetingDetail(meeting)} />
            ))}
          </div>
        )}
      </div>

      <MeetingDetailModal meeting={selectedMeeting} open={modalOpen} onOpenChange={setModalOpen} />
    </>
  )
}

function MeetingCard({ meeting, onClick }: { meeting: Meeting; onClick: () => void }) {
  const startTime = new Date(meeting.startTime)
  const endTime = new Date(meeting.endTime)

  return (
    <button
      onClick={onClick}
      className="w-full rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-primary/50 hover:bg-primary/2"
    >
      {/* Status indicator */}
      {meeting.status === "deleted_in_calendar" && (
        <div className="mb-2 text-xs font-medium text-orange-600 dark:text-orange-400">
          Archived
        </div>
      )}

      {/* Title */}
      <h4 className="font-semibold text-foreground text-sm line-clamp-2">{meeting.title}</h4>

      {/* Time */}
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Calendar className="h-3.5 w-3.5" />
        <span>
          {format(startTime, "MMM d, h:mm a")} - {format(endTime, "h:mm a")}
        </span>
      </div>

      {/* Attendees count + documents */}
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {meeting.attendeeEmails.length} attendee{meeting.attendeeEmails.length !== 1 ? "s" : ""}
        </span>
        {meeting.hasDocuments && (
          <div className="flex items-center gap-1 text-primary">
            <FileText className="h-3.5 w-3.5" />
            <span>Docs</span>
          </div>
        )}
      </div>
    </button>
  )
}
