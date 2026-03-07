"use client"
// REBUILD-2026-03-07-v4
import { useState } from "react"
import type { Meeting } from "@/lib/mock-data"
import { MeetingDetailModal } from "./meeting-detail-modal"
import { format } from "date-fns"
import { Calendar, FileText, Archive } from "lucide-react"

interface MeetingsListProps {
  meetings: Meeting[]
}

export default function MeetingsList({ meetings }: MeetingsListProps) {
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  // Sort chronologically, newest first
  const sorted = [...meetings].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())

  function openMeetingDetail(meeting: Meeting) {
    setSelectedMeeting(meeting)
    setModalOpen(true)
  }

  if (sorted.length === 0) return null

  return (
    <>
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">All Meetings</h3>
        <div className="space-y-2">
          {sorted.map((meeting) => (
            <MeetingListItem key={meeting.id} meeting={meeting} onClick={() => openMeetingDetail(meeting)} />
          ))}
        </div>
      </div>

      <MeetingDetailModal meeting={selectedMeeting} open={modalOpen} onOpenChange={setModalOpen} />
    </>
  )
}

// v3 - Fixed date validation
function MeetingListItem({ meeting, onClick }: { meeting: Meeting; onClick: () => void }) {
  // Safely parse dates with validation
  const startTime = meeting.startTime ? new Date(meeting.startTime) : null
  const endTime = meeting.endTime ? new Date(meeting.endTime) : null
  const isValidDate = startTime && !isNaN(startTime.getTime()) && endTime && !isNaN(endTime.getTime())
  const isPast = isValidDate ? endTime < new Date() : false

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 rounded-lg border p-3 transition-colors text-left ${
        isPast
          ? "border-border/60 bg-muted/30 hover:border-border"
          : "border-border bg-card hover:border-primary/50"
      }`}
    >
      {/* Date column */}
      <div className="min-w-20 text-left">
        <div className="text-xs font-semibold text-muted-foreground uppercase">
          {isValidDate ? format(startTime, "MMM") : "—"}
        </div>
        <div className="text-lg font-bold text-foreground">
          {isValidDate ? format(startTime, "d") : "—"}
        </div>
      </div>

      {/* Meeting details */}
      <div className="flex-1 min-w-0">
        {meeting.status === "deleted_in_calendar" && (
          <div className="mb-1 flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400">
            <Archive className="h-3 w-3" />
            <span>Archived</span>
          </div>
        )}
        <h4 className="font-semibold text-foreground text-sm line-clamp-1">
          {meeting.title}
        </h4>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>{isValidDate ? `${format(startTime, "h:mm a")} - ${format(endTime, "h:mm a")}` : "Time unknown"}</span>
          </div>
          <span>•</span>
          <span>{meeting.attendeeEmails.length} attendees</span>
        </div>
      </div>

      {/* Documents indicator */}
      {meeting.hasDocuments && (
        <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary">
          <FileText className="h-3.5 w-3.5" />
          <span>{meeting.documentCount || 1} doc{(meeting.documentCount || 1) !== 1 ? "s" : ""}</span>
        </div>
      )}
    </button>
  )
}
