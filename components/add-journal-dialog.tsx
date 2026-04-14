"use client"

import { useState, useEffect } from "react"
import { useApp } from "@/lib/store"
import type { Journal, JournalFrequency } from "@/lib/mock-data"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface AddJournalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editJournal?: Journal | null
}

export function AddJournalDialog({ open, onOpenChange, editJournal }: AddJournalDialogProps) {
  const { activeClient, addJournal, updateJournal } = useApp()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [frequency, setFrequency] = useState<JournalFrequency>("weekly")
  const [assignedMemberId, setAssignedMemberId] = useState<string>("all")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      if (editJournal) {
        setTitle(editJournal.title)
        setDescription(editJournal.description ?? "")
        setFrequency(editJournal.frequency)
        setAssignedMemberId(editJournal.assignedMemberId ?? "all")
      } else {
        setTitle("")
        setDescription("")
        setFrequency("weekly")
        setAssignedMemberId("all")
      }
    }
  }, [open, editJournal])

  async function handleSave() {
    const trimmed = title.trim()
    if (!trimmed) return
    setSaving(true)
    const memberId = assignedMemberId === "all" ? null : assignedMemberId

    if (editJournal) {
      updateJournal(editJournal.id, {
        title: trimmed,
        description: description.trim() || undefined,
        frequency,
        assignedMemberId: memberId,
      })
    } else {
      await addJournal(trimmed, description.trim() || undefined, frequency, memberId)
    }

    setSaving(false)
    onOpenChange(false)
  }

  const members = activeClient.members ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editJournal ? "Edit Journal" : "Add Journal"}</DialogTitle>
          <DialogDescription>
            {editJournal ? "Update this reflection prompt." : "Create a periodic reflection prompt for your members."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="journal-title">Question / Prompt</Label>
            <Input
              id="journal-title"
              placeholder="What did you accomplish this week?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="journal-description">Guidance (optional)</Label>
            <Textarea
              id="journal-description"
              placeholder="Describe what you're looking for in the reflection..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Frequency</Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as JournalFrequency)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="biweekly">Biweekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Assigned to</Label>
            <Select value={assignedMemberId} onValueChange={setAssignedMemberId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Members</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!title.trim() || saving}>
            {saving ? "Saving..." : editJournal ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
