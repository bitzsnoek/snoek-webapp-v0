"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useApp } from "@/lib/store"
import {
  getActiveJournals,
  getCurrentPeriodKey,
  getPeriodSeries,
  getJournalFrequencyLabel,
  formatPeriodKey,
  type Journal,
  type JournalEntry,
  type GoalFrequency,
} from "@/lib/mock-data"
import { CompletionStrip } from "./journal-completion-strip"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Check, Loader2, Pencil, ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface WritingState {
  journal: Journal
  periodKey: string
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function isoWeekMonday(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7
  const mondayW1 = new Date(jan4)
  mondayW1.setUTCDate(jan4.getUTCDate() - jan4Day + 1)
  const target = new Date(mondayW1)
  target.setUTCDate(target.getUTCDate() + (week - 1) * 7)
  return target
}

function formatShortDate(d: Date): string {
  return `${MONTH_ABBR[d.getUTCMonth()]} ${d.getUTCDate()}`
}

function formatPeriodDateRange(key: string, frequency: GoalFrequency): string | null {
  switch (frequency) {
    case "weekly": {
      const [yStr, wStr] = key.split("-W")
      const year = parseInt(yStr, 10)
      const week = parseInt(wStr, 10)
      if (!year || !week) return null
      const monday = isoWeekMonday(year, week)
      const sunday = new Date(monday)
      sunday.setUTCDate(sunday.getUTCDate() + 6)
      return `${formatShortDate(monday)} – ${formatShortDate(sunday)}`
    }
    case "biweekly": {
      const [yStr, bwStr] = key.split("-BW")
      const year = parseInt(yStr, 10)
      const biweek = parseInt(bwStr, 10)
      if (!year || !biweek) return null
      const monday = isoWeekMonday(year, (biweek - 1) * 2 + 1)
      const end = new Date(monday)
      end.setUTCDate(end.getUTCDate() + 13)
      return `${formatShortDate(monday)} – ${formatShortDate(end)}`
    }
    case "monthly": {
      const [yStr] = key.split("-")
      return yStr || null
    }
    default:
      return null
  }
}

export function MemberJournalsView() {
  const { activeClient, currentUser, upsertJournalEntry, pendingJournalNav, setPendingJournalNav } = useApp()
  const [writing, setWriting] = useState<WritingState | null>(null)

  const journals = useMemo(() => {
    const active = getActiveJournals(activeClient)
    // Filter to journals assigned to this member or to all members
    const memberRecord = (activeClient.allMembers ?? []).find(
      (m) => m.email === currentUser.email || m.name === currentUser.name
    )
    return active.filter(
      (j) => j.assignedMemberId === null || j.assignedMemberId === memberRecord?.id
    )
  }, [activeClient, currentUser])

  // When a chat attachment requested navigation to a specific entry, open it
  // in writing mode and clear the pending request.
  useEffect(() => {
    if (!pendingJournalNav) return
    const journal = journals.find((j) => j.id === pendingJournalNav.journalId)
    if (journal) {
      setWriting({ journal, periodKey: pendingJournalNav.periodKey })
    }
    setPendingJournalNav(null)
  }, [pendingJournalNav, journals, setPendingJournalNav])

  if (writing) {
    return (
      <WritingMode
        journal={writing.journal}
        periodKey={writing.periodKey}
        onBack={() => setWriting(null)}
        onSave={upsertJournalEntry}
      />
    )
  }

  return (
    <OverviewMode
      journals={journals}
      onWrite={(journal, periodKey) => setWriting({ journal, periodKey })}
    />
  )
}

// ============================================================
// Overview Mode
// ============================================================

function OverviewMode({
  journals,
  onWrite,
}: {
  journals: Journal[]
  onWrite: (journal: Journal, periodKey: string) => void
}) {
  if (journals.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
        No journal prompts assigned yet. Your coach will set these up for you.
      </div>
    )
  }

  if (journals.length === 1) {
    return <SingleJournalView journal={journals[0]} onWrite={onWrite} />
  }

  // Sort by urgency: daily first, then weekly, biweekly, monthly
  const frequencyOrder = { daily: 0, weekly: 1, biweekly: 2, monthly: 3 }
  const sorted = [...journals].sort(
    (a, b) => (frequencyOrder[a.frequency] ?? 9) - (frequencyOrder[b.frequency] ?? 9)
  )

  return (
    <div className="space-y-4">
      {sorted.map((journal) => (
        <JournalCard key={journal.id} journal={journal} onWrite={onWrite} />
      ))}
    </div>
  )
}

function SingleJournalView({
  journal,
  onWrite,
}: {
  journal: Journal
  onWrite: (journal: Journal, periodKey: string) => void
}) {
  const currentKey = getCurrentPeriodKey(journal.frequency as GoalFrequency)

  const periods = useMemo(() => {
    const series = getPeriodSeries(
      journal.frequency as GoalFrequency,
      Object.keys(journal.entries)
    )
    return series.filter((k) => k <= currentKey).reverse()
  }, [journal.frequency, journal.entries, currentKey])

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">{journal.title}</h2>
          <Badge variant="secondary" className="text-xs shrink-0">
            {getJournalFrequencyLabel(journal.frequency)}
          </Badge>
        </div>
        {journal.description ? (
          <p className="text-sm text-muted-foreground mt-1">{journal.description}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        {periods.map((periodKey) => (
          <PeriodRow
            key={periodKey}
            periodKey={periodKey}
            frequency={journal.frequency}
            entry={journal.entries[periodKey]}
            isCurrent={periodKey === currentKey}
            onClick={() => onWrite(journal, periodKey)}
          />
        ))}
      </div>
    </div>
  )
}

function PeriodRow({
  periodKey,
  frequency,
  entry,
  isCurrent,
  onClick,
}: {
  periodKey: string
  frequency: Journal["frequency"]
  entry: JournalEntry | undefined
  isCurrent: boolean
  onClick: () => void
}) {
  const hasEntry = !!entry
  const dateRange = formatPeriodDateRange(periodKey, frequency as GoalFrequency)
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-lg border px-4 py-3 transition-colors",
        isCurrent
          ? "border-primary bg-primary/5 hover:bg-primary/10"
          : hasEntry
            ? "border-border bg-card hover:bg-muted/30"
            : "border-dashed border-border/60 hover:bg-muted/20"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">
              {formatPeriodKey(periodKey, frequency as GoalFrequency)}
            </span>
            {dateRange ? (
              <span className="text-xs text-muted-foreground">{dateRange}</span>
            ) : null}
            {isCurrent ? (
              <Badge variant="default" className="h-5 px-1.5 text-[10px]">
                Current
              </Badge>
            ) : null}
          </div>
          <p
            className={cn(
              "mt-1 text-sm whitespace-pre-wrap",
              hasEntry ? "text-foreground line-clamp-2" : "text-muted-foreground"
            )}
          >
            {hasEntry ? entry!.content : "No entry yet"}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 inline-flex items-center gap-1 text-xs",
            hasEntry ? "text-primary" : "text-muted-foreground"
          )}
        >
          {hasEntry ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Done
            </>
          ) : (
            <>
              <Pencil className="h-3.5 w-3.5" />
              Empty
            </>
          )}
        </span>
      </div>
    </button>
  )
}

function JournalCard({
  journal,
  onWrite,
}: {
  journal: Journal
  onWrite: (journal: Journal, periodKey: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const currentKey = getCurrentPeriodKey(journal.frequency as GoalFrequency)
  const currentEntry = journal.entries[currentKey]
  const filledKeys = new Set(Object.keys(journal.entries))

  // Generate period series for the expanded view (past periods to write/edit)
  const periods = useMemo(() => {
    const series = getPeriodSeries(journal.frequency as GoalFrequency, Array.from(filledKeys))
    // Sort descending (most recent first), filter out future periods beyond current
    return series.filter((k) => k <= currentKey).reverse()
  }, [journal.frequency, filledKeys, currentKey])

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium">{journal.title}</h3>
            <Badge variant="secondary" className="text-xs shrink-0">
              {getJournalFrequencyLabel(journal.frequency)}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {formatPeriodKey(currentKey, journal.frequency as GoalFrequency)}
          </p>
          {journal.description && (
            <p className="text-sm text-muted-foreground mt-1">{journal.description}</p>
          )}
        </div>

        {currentEntry ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onWrite(journal, currentKey)}
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => onWrite(journal, currentKey)}
          >
            Write
          </Button>
        )}
      </div>

      <CompletionStrip frequency={journal.frequency} filledKeys={filledKeys} createdAt={journal.createdAt} />

      {/* Current period preview */}
      {currentEntry && (
        <div className="rounded-md bg-muted/30 border border-border/50 px-3 py-2">
          <p className="text-sm line-clamp-2 whitespace-pre-wrap">{currentEntry.content}</p>
        </div>
      )}

      {/* Past periods toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        Past periods
      </button>

      {/* Expanded period list */}
      {expanded && (
        <div className="space-y-1.5">
          {periods.filter((k) => k !== currentKey).map((periodKey) => {
            const entry = journal.entries[periodKey]
            return (
              <button
                key={periodKey}
                onClick={() => onWrite(journal, periodKey)}
                className="w-full text-left rounded-md border border-border/50 px-3 py-2 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {formatPeriodKey(periodKey, journal.frequency as GoalFrequency)}
                  </span>
                  {entry ? (
                    <span className="text-xs text-primary">Edit</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Write</span>
                  )}
                </div>
                {entry && (
                  <p className="text-sm text-foreground line-clamp-1 whitespace-pre-wrap mt-0.5">
                    {entry.content}
                  </p>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Writing Mode — focused, minimal chrome
// ============================================================

function WritingMode({
  journal,
  periodKey,
  onBack,
  onSave,
}: {
  journal: Journal
  periodKey: string
  onBack: () => void
  onSave: (journalId: string, periodKey: string, content: string) => void
}) {
  const existingEntry = journal.entries[periodKey]
  const [content, setContent] = useState(existingEntry?.content ?? "")
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef(content)

  const doSave = useCallback(
    (text: string) => {
      if (text === lastSavedRef.current && lastSavedRef.current !== "") return
      setSaveStatus("saving")
      onSave(journal.id, periodKey, text)
      lastSavedRef.current = text
      setTimeout(() => setSaveStatus("saved"), 300)
    },
    [journal.id, periodKey, onSave]
  )

  const handleChange = useCallback(
    (text: string) => {
      setContent(text)
      setSaveStatus("idle")
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => doSave(text), 1500)
    },
    [doSave]
  )

  const handleBlur = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (content !== lastSavedRef.current) {
      doSave(content)
    }
  }, [content, doSave])

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back
        </Button>
        <span
          className={cn(
            "text-xs transition-opacity",
            saveStatus === "idle"
              ? "opacity-0"
              : saveStatus === "saving"
                ? "text-muted-foreground"
                : "text-primary"
          )}
        >
          {saveStatus === "saving" && (
            <>
              <Loader2 className="inline mr-1 h-3 w-3 animate-spin" />
              Saving...
            </>
          )}
          {saveStatus === "saved" && (
            <>
              <Check className="inline mr-1 h-3 w-3" />
              Saved
            </>
          )}
        </span>
      </div>

      {/* Prompt */}
      <div>
        <h2 className="text-lg font-semibold">{journal.title}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {formatPeriodKey(periodKey, journal.frequency as GoalFrequency)}
          <span className="mx-1.5">&middot;</span>
          {getJournalFrequencyLabel(journal.frequency)}
        </p>
        {journal.description && (
          <p className="text-sm text-muted-foreground mt-2 italic">{journal.description}</p>
        )}
      </div>

      {/* Writing area */}
      <Textarea
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        placeholder="Start writing..."
        className="min-h-[240px] text-base leading-relaxed resize-none border-border/50 focus:border-primary/50"
        autoFocus
      />
    </div>
  )
}
