"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { FileUp, X, Loader2 } from "lucide-react"

interface MeetingDocumentUploadProps {
  meetingId: string
  onDocumentAdded?: () => void
}

export function MeetingDocumentUpload({ meetingId, onDocumentAdded }: MeetingDocumentUploadProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [documentType, setDocumentType] = useState<"transcript" | "notes" | "other">("transcript")
  const [uploading, setUploading] = useState(false)

  async function handleUpload() {
    if (!title.trim() || !content.trim()) return

    setUploading(true)
    try {
      const res = await fetch(`/api/meetings/${meetingId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          documentType,
        }),
      })

      if (res.ok) {
        setTitle("")
        setContent("")
        setDocumentType("transcript")
        setOpen(false)
        onDocumentAdded?.()
      } else {
        const error = await res.json()
        alert(`Failed to upload: ${error.error}`)
      }
    } catch (error) {
      console.error("Upload error:", error)
      alert("Failed to upload document")
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <FileUp className="h-4 w-4" />
        Add Document
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Meeting Document</DialogTitle>
            <DialogDescription>
              Upload a transcript, notes, or other document related to this meeting. The content will be processed and made searchable.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Title
              </label>
              <Input
                placeholder="e.g. Meeting Transcript, Action Items"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={uploading}
              />
            </div>

            {/* Document Type */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Document Type
              </label>
              <div className="flex gap-2">
                {(["transcript", "notes", "other"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setDocumentType(type)}
                    disabled={uploading}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      documentType === type
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Content
              </label>
              <textarea
                placeholder="Paste the document content here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={uploading}
                className="w-full min-h-48 p-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!title.trim() || !content.trim() || uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Uploading...
                  </>
                ) : (
                  "Upload Document"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
