"use client"

import { useState, useMemo, useEffect } from "react"
import { useApp } from "@/lib/store"
import {
  getActiveJournals,
  getJournalFrequencyLabel,
  formatPeriodKey,
  type Journal,
  type GoalFrequency,
} from "@/lib/mock-data"
import { CompletionStrip } from "./journal-completion-strip"
import { AddJournalDialog } from "./add-journal-dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Plus, MoreHorizontal, Pencil, Archive, ChevronDown, ChevronRight } from "lucide-react"

export function CoachJournalsView() {
  const { activeClient, updateJournal, pendingJournalNav, setPendingJournalNav } = useApp()
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editJournal, setEditJournal] = useState<Journal | null>(null)
  const [memberFilter, setMemberFilter] = useState<string>("all")

  // Coaches don't have a writing mode — just clear the pending nav so the
  // effect doesn't re-fire, and scroll the requested journal card into view.
  useEffect(() => {
    if (!pendingJournalNav) return
    const el = document.getElementById(`journal-card-${pendingJournalNav.journalId}`)
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
    setPendingJournalNav(null)
  }, [pendingJournalNav, setPendingJournalNav])

  const activeJournals = useMemo(() => getActiveJournals(activeClient), [activeClient])
  const members = activeClient.members ?? []

  const filteredJournals = useMemo(() => {
    if (memberFilter === "all") return activeJournals
    return activeJournals.filter((j) => j.assignedMemberId === memberFilter || j.assignedMemberId === null)
  }, [activeJournals, memberFilter])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Select value={memberFilter} onValueChange={setMemberFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Members" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Members</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => { setEditJournal(null); setAddDialogOpen(true) }}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Journal
        </Button>
      </div>

      {/* Journal cards */}
      {filteredJournals.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
          No journals yet. Create one to get started.
        </div>
      )}

      <div className="space-y-4">
        {filteredJournals.map((journal) => (
          <JournalCard
            key={journal.id}
            journal={journal}
            onEdit={() => { setEditJournal(journal); setAddDialogOpen(true) }}
            onArchive={() => updateJournal(journal.id, { archived: true })}
          />
        ))}
      </div>

      <AddJournalDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        editJournal={editJournal}
      />
    </div>
  )
}

function JournalCard({
  journal,
  onEdit,
  onArchive,
}: {
  journal: Journal
  onEdit: () => void
  onArchive: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  const entries = Object.values(journal.entries).sort((a, b) =>
    b.periodKey.localeCompare(a.periodKey)
  )
  const filledKeys = new Set(Object.keys(journal.entries))
  const previewEntries = entries.slice(0, 5)
  const hasMore = entries.length > 5

  return (
    <div id={`journal-card-${journal.id}`} className="rounded-lg border border-border bg-card p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-sm truncate">{journal.title}</h3>
            <Badge variant="secondary" className="shrink-0 text-xs">
              {getJournalFrequencyLabel(journal.frequency)}
            </Badge>
            {journal.assignedMember && (
              <Badge variant="outline" className="shrink-0 text-xs">
                {journal.assignedMember}
              </Badge>
            )}
          </div>
          {journal.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{journal.description}</p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onArchive}>
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Completion strip */}
      <CompletionStrip frequency={journal.frequency} filledKeys={filledKeys} createdAt={journal.createdAt} />

      {/* Entries */}
      {entries.length > 0 && (
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {entries.length} {entries.length === 1 ? "entry" : "entries"}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            {(expanded ? entries : previewEntries).map((entry) => (
              <div key={entry.id} className="rounded-md border border-border/50 bg-muted/30 px-3 py-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    {formatPeriodKey(entry.periodKey, journal.frequency as GoalFrequency)}
                  </span>
                  {entry.authorName && (
                    <span className="text-xs text-muted-foreground">
                      by {entry.authorName}
                    </span>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap">{entry.content}</p>
              </div>
            ))}
            {!expanded && hasMore && (
              <button
                onClick={() => setExpanded(true)}
                className="text-xs text-primary hover:underline"
              >
                Show {entries.length - 5} more...
              </button>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

      {entries.length === 0 && (
        <p className="text-xs text-muted-foreground italic">No entries yet</p>
      )}
    </div>
  )
}
