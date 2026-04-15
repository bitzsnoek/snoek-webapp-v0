"use client"

import { useState, useRef, useCallback } from "react"
import type { KeyResult } from "@/lib/mock-data"
import { getProgressPercent, sumWeeklyValues, getCurrentWeekKey, getWeeksOnTarget, getQuarterISOWeeks } from "@/lib/mock-data"
import { useApp } from "@/lib/store"
import { useOptionalRealtimeGoals } from "@/lib/realtime-goals-context"
import { EditingIndicator } from "@/components/editing-indicator"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import {
  ArrowUpRight,
  ArrowDownRight,
  FolderKanban,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  UserPlus,
  UserMinus,
} from "lucide-react"

const typeConfig = {
  input: {
    label: "Input",
    icon: ArrowUpRight,
    color: "text-chart-2",
    bgColor: "bg-chart-2/10",
  },
  output: {
    label: "Output",
    icon: ArrowDownRight,
    color: "text-chart-1",
    bgColor: "bg-chart-1/10",
  },
  project: {
    label: "Project",
    icon: FolderKanban,
    color: "text-chart-3",
    bgColor: "bg-chart-3/10",
  },
}

// ── Editable cell for output / project KRs (plain number) ──────────────────

function EditableCell({
  week,
  value,
  krId,
}: {
  week: string
  value: number
  krId: string
}) {
  const { updateWeeklyValue } = useApp()
  const realtimeContext = useOptionalRealtimeGoals()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value || ""))
  const inputRef = useRef<HTMLInputElement>(null)

  const cellId = `${krId}:${week}`

  const commit = useCallback(() => {
    setEditing(false)
    realtimeContext?.stopEditing()
    const parsed = parseInt(draft, 10)
    const newVal = isNaN(parsed) || parsed < 0 ? 0 : parsed
    if (newVal !== value) updateWeeklyValue(krId, week, newVal)
    setDraft(String(newVal || ""))
  }, [draft, value, krId, week, updateWeeklyValue, realtimeContext])

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min={0}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit()
          if (e.key === "Escape") { setDraft(String(value || "")); setEditing(false) }
        }}
        autoFocus
        className="h-7 w-12 rounded-md border border-ring bg-background text-center text-xs text-foreground outline-none ring-1 ring-ring/30 focus:ring-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    )
  }

  // Check if someone else is editing this cell
  const editingUser = realtimeContext?.getEditingUser(cellId)

  return (
    <button
      onClick={() => { 
        setDraft(String(value || "")); 
        setEditing(true)
        realtimeContext?.startEditing(cellId, "weekly_value")
      }}
      className={cn(
        "inline-flex h-7 w-12 items-center justify-center rounded-md text-xs transition-colors cursor-text",
        editingUser ? "ring-2 ring-amber-500/50 bg-amber-500/10" :
        value > 0
          ? "bg-primary/10 font-medium text-primary hover:bg-primary/20"
          : "text-muted-foreground/50 hover:bg-secondary hover:text-muted-foreground"
      )}
      title={editingUser ? `${editingUser.name} is editing` : `Click to edit ${week}`}
    >
      {value || "-"}
    </button>
  )
}

// ── Editable cell for input KRs — shows met/not-met + editable value ────────

function InputCell({
  week,
  value,
  target,
  krId,
  isFuture,
}: {
  week: string
  value: number
  target: number
  krId: string
  isFuture: boolean
}) {
  const { updateWeeklyValue } = useApp()
  const realtimeContext = useOptionalRealtimeGoals()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value || ""))

  const cellId = `${krId}:${week}`

  const commit = useCallback(() => {
    setEditing(false)
    realtimeContext?.stopEditing()
    const parsed = parseInt(draft, 10)
    const newVal = isNaN(parsed) || parsed < 0 ? 0 : parsed
    if (newVal !== value) updateWeeklyValue(krId, week, newVal)
    setDraft(String(newVal || ""))
  }, [draft, value, krId, week, updateWeeklyValue, realtimeContext])

  // Check if someone else is editing this cell
  const editingUser = realtimeContext?.getEditingUser(cellId)

  const met = value >= target
  const hasValue = value > 0

  if (editing) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <input
          type="number"
          min={0}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit()
            if (e.key === "Escape") { setDraft(String(value || "")); setEditing(false) }
          }}
          autoFocus
          className="h-7 w-12 rounded-md border border-ring bg-background text-center text-xs text-foreground outline-none ring-1 ring-ring/30 focus:ring-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="text-[10px] text-muted-foreground/50">target {target}</span>
      </div>
    )
  }

  if (isFuture && !hasValue) {
    // Future empty week — just a dim dash, still clickable
    return (
      <button
        onClick={() => { 
          setDraft(""); 
          setEditing(true)
          realtimeContext?.startEditing(cellId, "weekly_value")
        }}
        className={cn(
          "inline-flex h-8 w-12 flex-col items-center justify-center gap-0.5 rounded-md transition-colors",
          editingUser 
            ? "ring-2 ring-amber-500/50 bg-amber-500/10 text-amber-500" 
            : "text-muted-foreground/30 hover:bg-secondary hover:text-muted-foreground"
        )}
        title={editingUser ? `${editingUser.name} is editing` : `Enter value for ${week}`}
      >
        <span className="text-xs">—</span>
      </button>
    )
  }

  return (
    <button
      onClick={() => { 
        setDraft(String(value || "")); 
        setEditing(true)
        realtimeContext?.startEditing(cellId, "weekly_value")
      }}
      className={cn(
        "inline-flex h-8 w-12 flex-col items-center justify-center gap-0.5 rounded-md transition-colors cursor-text",
        editingUser
          ? "ring-2 ring-amber-500/50 bg-amber-500/10"
          : !hasValue
          ? "text-muted-foreground/30 hover:bg-secondary hover:text-muted-foreground"
          : met
          ? "bg-primary/10 hover:bg-primary/20"
          : "bg-destructive/10 hover:bg-destructive/15"
      )}
      title={editingUser ? `${editingUser.name} is editing` : `${value} / ${target} — click to edit`}
    >
      {hasValue ? (
        <>
          <span className={cn("text-xs font-semibold leading-none", met ? "text-primary" : "text-destructive")}>
            {value}
          </span>
          <span className={cn("leading-none", met ? "text-primary/70" : "text-destructive/70")}>
            {met
              ? <Check className="h-2.5 w-2.5" />
              : <X className="h-2.5 w-2.5" />
            }
          </span>
        </>
      ) : (
        <span className="text-xs">—</span>
      )}
    </button>
  )
}

// ── Owner picker ────────────────────────────────────────────────────────────

function OwnerPicker({
  kr,
  quarterId,
  goalId,
}: {
  kr: KeyResult
  quarterId: string
  goalId: string
}) {
  const { activeClient, assignKROwner } = useApp()
  const members = activeClient.allMembers ?? []

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full transition-colors",
            kr.owner
              ? "ring-1 ring-border hover:ring-primary/50"
              : "border border-dashed border-muted-foreground/30 text-muted-foreground/40 hover:border-primary/50 hover:text-primary"
          )}
          title={kr.owner ? `Assigned to ${kr.owner} — click to change` : "Assign owner"}
        >
          {kr.owner ? (
            <Avatar className="h-6 w-6">
              <AvatarFallback className="bg-secondary text-[10px] text-foreground">
                {kr.owner.split(" ").map((n) => n[0]).join("")}
              </AvatarFallback>
            </Avatar>
          ) : (
            <UserPlus className="h-3 w-3" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4}>
        <DropdownMenuLabel className="text-xs text-muted-foreground">Assign owner</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {members.map((member) => (
          <DropdownMenuItem
            key={member.id}
            onClick={() => assignKROwner(quarterId, goalId, kr.id, member.name)}
            className="gap-2"
          >
            <Avatar className="h-5 w-5">
              <AvatarFallback className="bg-secondary text-[9px] text-foreground">
                {member.name.split(" ").map((n) => n[0]).join("")}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm">{member.name}</span>
              <span className="text-xs text-muted-foreground capitalize">{member.roleTitle || member.role}</span>
            </div>
            {kr.owner === member.name && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
        {kr.owner && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => assignKROwner(quarterId, goalId, kr.id, null)}
              className="gap-2 text-muted-foreground"
            >
              <UserMinus className="h-4 w-4" />
              Unassign
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Main card ───────────────────────────────────────────────────────────────

export function KeyResultCard({
  kr,
  quarterId,
  goalId,
}: {
  kr: KeyResult
  quarterId: string
  goalId: string
}) {
  const [expanded, setExpanded] = useState(false)
  const realtimeContext = useOptionalRealtimeGoals()
  const isInput = kr.type === "input"
  const progress = getProgressPercent(kr)
  const total = sumWeeklyValues(kr)
  const config = typeConfig[kr.type]
  const TypeIcon = config.icon
  const { met, total: trackedWeeks } = getWeeksOnTarget(kr)
  
  // Check if anyone is editing any cell in this KR
  const editingUsers = realtimeContext?.getAllEditingUsers().filter(
    u => u.editingId?.startsWith(kr.id)
  ) ?? []
  const hasActiveEditors = editingUsers.length > 0

  const currentWeek = getCurrentWeekKey()
  const currentWeekNum = parseInt(currentWeek.replace("W", ""), 10)

  // Always show all 13 weeks of a quarter, even if no data exists yet
  const dataWeeks = Object.keys(kr.weeklyValues)
  const maxWeek = dataWeeks.length > 0
    ? Math.max(13, ...dataWeeks.map((w) => parseInt(w.replace("W", ""), 10)))
    : 13
  const weeks = Array.from({ length: maxWeek }, (_, i) => `W${i + 1}`)

  // Resolve the quarter's calendar year + quarter number from `quarterId`
  // (format: "${year}-${quarter}", see supabase-data.ts:171). Fall back to the
  // current quarter if the id is malformed.
  const [qYearStr, qNumStr] = quarterId.split("-")
  const qYear = Number.parseInt(qYearStr, 10)
  const qNum = Number.parseInt(qNumStr, 10)
  const now = new Date()
  const safeYear = Number.isFinite(qYear) ? qYear : now.getFullYear()
  const safeQuarter = (qNum >= 1 && qNum <= 4 ? qNum : Math.floor(now.getMonth() / 3) + 1) as 1 | 2 | 3 | 4
  const isoWeekNumbers = getQuarterISOWeeks(safeYear, safeQuarter, maxWeek)

  return (
    <div className={cn(
      "rounded-lg border bg-background/50 p-4 transition-colors hover:border-border/80",
      hasActiveEditors && "ring-2 ring-amber-500/30",
      kr.owner
        ? "border-border"
        : "border-border/50 opacity-60"
    )}>
      {/* Active editors indicator */}
      {hasActiveEditors && (
        <div className="mb-3 flex items-center gap-2 text-xs text-amber-500">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
          </span>
          <div className="flex -space-x-1">
            {editingUsers.slice(0, 3).map((user) => (
              <span
                key={user.id}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-amber-500/20 text-[8px] font-medium text-amber-600"
                title={user.name}
              >
                {user.avatar}
              </span>
            ))}
          </div>
          <span>
            {editingUsers.length === 1
              ? `${editingUsers[0].name} is editing`
              : `${editingUsers.length} people editing`}
          </span>
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        {/* Left: icon + title */}
        <div className="flex items-start gap-3 min-w-0">
          <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md", config.bgColor)}>
            <TypeIcon className={cn("h-3.5 w-3.5", config.color)} />
          </div>
          <div className="min-w-0 flex-1">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-2 hover:opacity-75 transition-opacity text-left w-full"
            >
              <p className="text-sm font-medium text-foreground">{kr.title}</p>
            </button>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn("text-xs", config.color)}>
                {config.label}
              </Badge>
              {isInput ? (
                <span className="text-xs text-muted-foreground">
                  {kr.target} / week
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {kr.type === "project" ? `${progress}% complete` : `${total} / ${kr.target}`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: summary stat + owner picker + expand */}
        <div className="flex items-center gap-3 ml-10 sm:ml-0 shrink-0">
          <OwnerPicker kr={kr} quarterId={quarterId} goalId={goalId} />

          {isInput ? (
            // Weeks-on-target pill
            trackedWeeks > 0 ? (
              <div className="flex items-center gap-1">
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    met === trackedWeeks ? "text-primary" : met / trackedWeeks >= 0.6 ? "text-chart-3" : "text-destructive"
                  )}
                >
                  {met}
                </span>
                <span className="text-xs text-muted-foreground">/ {trackedWeeks} wks</span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">no data</span>
            )
          ) : (
            <span
              className={cn(
                "text-sm font-semibold tabular-nums",
                progress >= 75 ? "text-primary" : progress >= 50 ? "text-chart-3" : "text-muted-foreground"
              )}
            >
              {progress}%
            </span>
          )}

          <button
            onClick={() => setExpanded(!expanded)}
            className="flex h-8 w-8 sm:h-6 sm:w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Progress bar — only for output / project */}
      {!isInput && (
        <div className="mt-3">
          <Progress value={Math.min(progress, 100)} className="h-1.5" />
        </div>
      )}

      {/* Expanded weekly table */}
      {expanded && (
        <div
          className="mt-4 -mx-4 px-4 overflow-x-auto pb-1"
          style={{ scrollbarWidth: "thin", scrollbarColor: "hsl(var(--border)) transparent" }}
        >
          <table className="w-full text-xs" style={{ minWidth: `${weeks.length * 52}px` }}>
            <thead>
              <tr>
                {weeks.map((week, i) => {
                  const isCurrent = week === currentWeek
                  return (
                    <th
                      key={week}
                      className={cn("pb-2 text-center font-medium", isCurrent ? "text-primary" : "text-muted-foreground")}
                    >
                      <span className={cn("inline-flex items-center justify-center rounded-full px-1.5 py-0.5", isCurrent && "bg-primary/10 font-semibold")}>
                        W{isoWeekNumbers[i]}
                      </span>
                    </th>
                  )
                })}
              </tr>
              {/* Target row for input KRs */}
              {isInput && (
                <tr>
                  {weeks.map((week) => (
                    <td key={week} className="pb-1 text-center">
                      <span className="text-[10px] text-muted-foreground/40">
                        {kr.target}
                      </span>
                    </td>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              <tr>
                {weeks.map((week) => {
                  const isCurrent = week === currentWeek
                  const weekNum = parseInt(week.replace("W", ""), 10)
                  const isFuture = weekNum > currentWeekNum
                  return (
                    <td key={week} className={cn("text-center", isCurrent && "relative")}>
                      {isCurrent && (
                        <div className="pointer-events-none absolute inset-x-0 -bottom-1 -top-1 rounded-md border border-primary/30 bg-primary/5" />
                      )}
                      {isInput ? (
                        <InputCell
                          week={week}
                          value={kr.weeklyValues[week] ?? 0}
                          target={kr.target}
                          krId={kr.id}
                          isFuture={isFuture}
                        />
                      ) : (
                        <EditableCell
                          week={week}
                          value={kr.weeklyValues[week] ?? 0}
                          krId={kr.id}
                        />
                      )}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
