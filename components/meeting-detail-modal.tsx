"use client"
// REBUILD-2026-03-07-v4
import { useState, useEffect } from "react"
import type { Meeting, MeetingDocument } from "@/lib/mock-data"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { MeetingDocumentUpload } from "./meeting-document-upload"
import { format } from "date-fns"
import { Calendar, Users, FileText, Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface MeetingDetailModalProps {
  meeting: Meeting | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MeetingDetailModal({ meeting, open, onOpenChange }: MeetingDetailModalProps) {
  const [documents, setDocuments] = useState<MeetingDocument[]>([])
  const [isLoadingDocs, setIsLoadingDocs] = useState(false)

  // Load documents when meeting changes
  useEffect(() => {
    if (meeting && open) {
      loadDocuments()
    }
  }, [meeting, open])

  async function loadDocuments() {
    if (!meeting) return
    setIsLoadingDocs(true)
    try {
      const res = await fetch(`/api/meeting-docs/${meeting.id}`)
      if (res.ok) {
        const data = await res.json()
        setDocuments(data.documents || [])
      }
    } catch (error) {
      console.error("Failed to load documents:", error)
    } finally {
      setIsLoadingDocs(false)
    }
  }

  async function handleDeleteDocument(docId: string) {
    if (!meeting) return
    try {
      const res = await fetch(`/api/meeting-docs/${meeting.id}?documentId=${docId}`, {
        method: "DELETE",
      })
      if (res.ok) {
        setDocuments(documents.filter((d) => d.id !== docId))
      }
    } catch (error) {
      console.error("Failed to delete document:", error)
    }
  }

  if (!meeting) return null

  const startTime = meeting.startTime ? new Date(meeting.startTime) : null
  const endTime = meeting.endTime ? new Date(meeting.endTime) : null
  const isValidDate = startTime && !isNaN(startTime.getTime()) && endTime && !isNaN(endTime.getTime())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-96 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{meeting.title}</DialogTitle>
          <DialogDescription className="sr-only">Meeting details and documents</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Meeting details */}
          <div className="space-y-3 pb-6 border-b border-border">
            {isValidDate && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>
                  {format(startTime, "MMMM d, yyyy")} • {format(startTime, "h:mm a")} -{" "}
                  {format(endTime, "h:mm a")}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{meeting.attendeeEmails.join(", ")}</span>
            </div>
            {meeting.description && (
              <p className="text-sm text-foreground">{meeting.description}</p>
            )}
          </div>

          {/* Documents section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documents
              </h3>
              <MeetingDocumentUpload
                meetingId={meeting.id}
                onDocumentAdded={loadDocuments}
              />
            </div>

            {isLoadingDocs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : documents.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center">
                <p className="text-sm text-muted-foreground">No documents yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add documents like transcripts or notes to this meeting
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-start justify-between p-3 rounded-lg bg-secondary/30 border border-border hover:border-primary/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-foreground line-clamp-1">
                        {doc.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {(doc.documentType || "other").charAt(0).toUpperCase() +
                            (doc.documentType || "other").slice(1)}
                        </span>
                        {doc.createdAt && (
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(doc.createdAt), "MMM d")}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                        {doc.content}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="ml-2 h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
