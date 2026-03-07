"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { FileUp, X, Loader2, File } from "lucide-react"

interface MeetingDocumentUploadProps {
  meetingId: string
  onDocumentAdded?: () => void
}

const ACCEPTED_FILE_TYPES = ".doc,.docx,.rtf,.pdf"
const ACCEPTED_MIME_TYPES = [
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/rtf",
  "text/rtf",
  "application/pdf",
]

export function MeetingDocumentUpload({ meetingId, onDocumentAdded }: MeetingDocumentUploadProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [documentType, setDocumentType] = useState<"transcript" | "notes" | "other">("transcript")
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileSelect(selectedFile: File | null) {
    if (!selectedFile) return
    
    if (!ACCEPTED_MIME_TYPES.includes(selectedFile.type)) {
      alert("Please select a .doc, .docx, .rtf, or .pdf file")
      return
    }
    
    setFile(selectedFile)
    // Auto-fill title from filename if empty
    if (!title) {
      const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "")
      setTitle(nameWithoutExt)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const droppedFile = e.dataTransfer.files[0]
    handleFileSelect(droppedFile)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
  }

  async function handleUpload() {
    if (!title.trim() || !file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("title", title.trim())
      formData.append("documentType", documentType)

      const res = await fetch(`/api/meeting-docs/${meetingId}`, {
        method: "POST",
        body: formData,
      })

      if (res.ok) {
        setTitle("")
        setFile(null)
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

  function resetAndClose() {
    setTitle("")
    setFile(null)
    setDocumentType("transcript")
    setOpen(false)
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

      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && resetAndClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Meeting Document</DialogTitle>
            <DialogDescription>
              Upload a transcript, notes, or other document related to this meeting.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* File Upload Area */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                File
              </label>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`relative cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                  dragOver
                    ? "border-primary bg-primary/5"
                    : file
                    ? "border-primary/50 bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-secondary/50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_FILE_TYPES}
                  onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                  className="hidden"
                  disabled={uploading}
                />
                
                {file ? (
                  <div className="flex items-center justify-center gap-3">
                    <File className="h-8 w-8 text-primary" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-foreground">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        setFile(null)
                      }}
                      className="ml-2 h-8 w-8 p-0"
                      disabled={uploading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div>
                    <FileUp className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-foreground">
                      Drop a file here or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Supports .doc, .docx, .rtf, .pdf
                    </p>
                  </div>
                )}
              </div>
            </div>

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

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-2">
              <Button
                variant="ghost"
                onClick={resetAndClose}
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!title.trim() || !file || uploading}
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
