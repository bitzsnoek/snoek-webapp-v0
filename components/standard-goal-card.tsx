"use client"

import { useState, useRef, useCallback } from "react"
import type { StandardGoal, Confidence, GoalFrequency } from "@/lib/mock-data"
import { isCoachOrAdmin, getStandardGoalProgress, getCurrentPeriodKey, getPeriodSeries, formatPeriodKey } from "@/lib/mock-data"
import { useApp } from "@/lib/store"
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
import { ReorderHandle } from "./reorder-handle"
import {
  Milestone as MilestoneIcon,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  UserPlus,
  UserMinus,
  Pencil,
  Trash2,
  Star,
  StarOff,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { AddStandardGoalDialog } from "./add-standard-goal-dialog"

// ── Confidence config ────────────────────────────────────────────────────────

const CONFIDENCE_OPTIONS: {
  value: Confidence
  label: string
  color: string
  dot: string
}[] = [
  { value: "not_started",          label: "Not started",          color: "text-muted-foreground",   dot: "bg-muted-foreground/40" },
  { value: "confident",            label: "Confident",            color: "text-emerald-400",         dot: "bg-emerald-400" },
  { value: "moderately_confident", label: "Moderately confident", color: "text-amber-400",           dot: "bg-amber-400" },
  { value: "not_confident",        label: "Not confident",        color: "text-red-400",             dot: "bg-red-400" },
  { value: "done",                 label: "Done",                 color: "text-sky-400",             dot: "bg-sky-400" },
  { value: "discontinued",         label: "Discontinued",         color: "text-muted-foreground/60", dot: "bg-muted-foreground/30" },
]

function getOption(confidence: Confidence) {
  return CONFIDENCE_OPTIONS.find((o) => o.value === confidence) ?? CONFIDENCE_OPTIONS[0]
}

// ── Editable cell — milestone (cumulative contribution per period) ───────────

function MilestoneCell({
  periodKey,
  value,
  isCurrent,
  goalId,
  boardId,
}: {
  periodKey: string
  value: number
  isCurrent: boolean
  goalId: string
  boardId: string
}) {
  const { updateStandardGoalValue } = useApp()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value || ""))

  const commit = useCallback(() => {
    setEditing(false)
    const parsed = parseFloat(draft)
    const newVal = isNaN(parsed) || parsed < 0 ? 0 : parsed
    if (newVal !== value) updateStandardGoalValue(boardId, goalId, periodKey, newVal)
    setDraft(String(newVal || ""))
  }, [draft, value, boardId, goalId, periodKey, updateStandardGoalValue])

  if (editing) {
    return (
      <input
        type="number"
        min={0}
        step="any"
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

  return (
    <button
      onClick={() => { setDraft(String(value || "")); setEditing(true) }}
      className={cn(
        "inline-flex h-7 w-12 items-center justify-center rounded-md text-xs transition-colors cursor-text",
        value > 0
          ? "bg-primary/10 font-medium text-primary hover:bg-primary/20"
          : "text-muted-foreground/50 hover:bg-secondary hover:text-muted-foreground"
      )}
    >
      {value || "–"}
    </button>
  )
}

// ── Editable cell — periodic (value vs per-period target) ───────────────────

function PeriodicCell({
  periodKey,
  value,
  target,
  isCurrent,
  isFuture,
  goalId,
  boardId,
}: {
  periodKey: string
  value: number
  target: number
  isCurrent: boolean
  isFuture: boolean
  goalId: string
  boardId: string
}) {
  const { updateStandardGoalValue } = useApp()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value || ""))

  const commit = useCallback(() => {
    setEditing(false)
    const parsed = parseFloat(draft)
    const newVal = isNaN(parsed) || parsed < 0 ? 0 : parsed
    if (newVal !== value) updateStandardGoalValue(boardId, goalId, periodKey, newVal)
    setDraft(String(newVal || ""))
  }, [draft, value, boardId, goalId, periodKey, updateStandardGoalValue])

  const met = value >= target
  const hasValue = value > 0

  if (editing) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <input
          type="number"
          min={0}
          step="any"
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
    return (
      <button
        onClick={() => { setDraft(""); setEditing(true) }}
        className="inline-flex h-8 w-12 flex-col items-center justify-center gap-0.5 rounded-md text-muted-foreground/30 transition-colors hover:bg-secondary hover:text-muted-foreground"
      >
        <span className="text-xs">—</span>
      </button>
    )
  }

  return (
    <button
      onClick={() => { setDraft(String(value || "")); setEditing(true) }}
      className={cn(
        "inline-flex h-8 w-12 flex-col items-center justify-center gap-0.5 rounded-md transition-colors cursor-text",
        !hasValue
          ? "text-muted-foreground/30 hover:bg-secondary hover:text-muted-foreground"
          : met
          ? "bg-primary/10 hover:bg-primary/20"
          : "bg-destructive/10 hover:bg-destructive/15"
      )}
    >
      {hasValue ? (
        <>
          <span className={cn("text-xs font-semibold leading-none", met ? "text-primary" : "text-destructive")}>
            {value}
          </span>
          <span className={cn("leading-none", met ? "text-primary/70" : "text-destructive/70")}>
            {met ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
          </span>
        </>
      ) : (
        <span className="text-xs">—</span>
      )}
    </button>
  )
}

// ── StandardGoalCard ────────────────────────────────────────────────────────

export function StandardGoalCard({
  goal,
  boardId,
  index,
  totalGoals,
  onMoveUp,
  onMoveDown,
}: {
  goal: StandardGoal
  boardId: string
  index: number
  totalGoals: number
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const {
    activeClient,
    currentUser,
    updateStandardGoal,
    deleteStandardGoal,
    updateStandardGoalValue,
    assignStandardGoalOwner,
  } = useApp()
  const isCoach = isCoachOrAdmin(currentUser.role)

  const [expanded, setExpanded] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  const progress = getStandardGoalProgress(goal)
  const opt = getOption(goal.confidence)

  const isMilestone = goal.goalType === "milestone"
  const frequency = isMilestone ? goal.checkInFrequency : goal.period
  const currentPeriodKey = frequency ? getCurrentPeriodKey(frequency) : null

  // For milestones: cumulative total across all check-ins
  const cumulativeTotal = Object.values(goal.values).reduce((s, v) => s + v, 0)

  // Period series for the grid
  const existingKeys = Object.keys(goal.values)
  const periods = frequency ? getPeriodSeries(frequency, existingKeys) : []

  // For periodic: count periods on-target
  const periodicStats = !isMilestone && frequency ? (() => {
    const tracked = periods.filter((k) => (goal.values[k] ?? 0) > 0)
    const onTarget = tracked.filter((k) => (goal.values[k] ?? 0) >= goal.targetValue)
    return { tracked: tracked.length, onTarget: onTarget.length }
  })() : null

  const allMembers = activeClient.allMembers ?? []
  const allNames = [...new Set([
    ...allMembers.map((m) => m.name),
    ...activeClient.members.map((m) => m.name),
  ])]

  function handleConfidenceChange(confidence: Confidence) {
    updateStandardGoal(boardId, goal.id, { confidence })
  }

  function handlePriorityToggle() {
    updateStandardGoal(boardId, goal.id, { isPriority: !goal.isPriority })
  }

  return (
    <div className={cn(
      "group/reorder rounded-xl border border-border bg-card transition-colors",
      goal.confidence === "discontinued" && "opacity-60"
    )}>
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Reorder handle (coach only) */}
        {isCoach && (
          <ReorderHandle
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            isFirst={index === 0}
            isLast={index === totalGoals - 1}
          />
        )}

        {/* Goal type badge */}
        <Badge
          variant="outline"
          className={cn(
            "shrink-0 gap-1 text-xs",
            isMilestone ? "text-chart-1 border-chart-1/30" : "text-chart-2 border-chart-2/30"
          )}
        >
          {isMilestone ? <MilestoneIcon className="h-3 w-3" /> : <RotateCcw className="h-3 w-3" />}
          {isMilestone ? "Milestone" : "Periodic"}
        </Badge>

        {/* Title + description */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="truncate text-sm font-medium text-foreground text-left hover:opacity-75 transition-opacity"
            >
              {goal.title}
            </button>
            {goal.isPriority && (
              <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
            )}
          </div>
          {goal.description && (
            <p className="truncate text-xs text-muted-foreground mt-0.5">{goal.description}</p>
          )}
        </div>

        {/* Progress */}
        <div className="hidden sm:flex items-center gap-3 shrink-0">
          {isMilestone ? (
            <span
              className={cn(
                "text-sm font-semibold tabular-nums",
                progress >= 75 ? "text-primary" : progress >= 50 ? "text-chart-3" : "text-muted-foreground"
              )}
            >
              {progress}%
            </span>
          ) : periodicStats && periodicStats.tracked > 0 ? (
            <div className="flex items-center gap-1">
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  periodicStats.onTarget === periodicStats.tracked
                    ? "text-primary"
                    : periodicStats.onTarget / periodicStats.tracked >= 0.6
                    ? "text-chart-3"
                    : "text-destructive"
                )}
              >
                {periodicStats.onTarget}
              </span>
              <span className="text-xs text-muted-foreground">/ {periodicStats.tracked}</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">no data</span>
          )}
        </div>

        {/* Confidence */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors hover:bg-secondary">
              <span className={cn("h-2 w-2 rounded-full", opt.dot)} />
              <span className={cn("hidden sm:inline", opt.color)}>{opt.label}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {CONFIDENCE_OPTIONS.map((o) => (
              <DropdownMenuItem
                key={o.value}
                onClick={() => handleConfidenceChange(o.value)}
                className="gap-2"
              >
                <span className={cn("h-2 w-2 rounded-full", o.dot)} />
                {o.label}
                {goal.confidence === o.value && <Check className="ml-auto h-3 w-3" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Owner avatar */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {goal.owner ? (
              <button className="shrink-0" title={goal.owner}>
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-secondary text-[10px] font-medium">
                    {goal.owner.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
              </button>
            ) : (
              <button className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground/40 hover:border-primary hover:text-primary transition-colors">
                <UserPlus className="h-3.5 w-3.5" />
              </button>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-xs">Assign owner</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {allNames.map((name) => (
              <DropdownMenuItem
                key={name}
                onClick={() => assignStandardGoalOwner(boardId, goal.id, name)}
                className="gap-2"
              >
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[8px]">
                    {name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                {name}
                {goal.owner === name && <Check className="ml-auto h-3 w-3" />}
              </DropdownMenuItem>
            ))}
            {goal.owner && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => assignStandardGoalOwner(boardId, goal.id, null)}
                  className="gap-2 text-muted-foreground"
                >
                  <UserMinus className="h-4 w-4" />
                  Unassign
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex h-8 w-8 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Progress bar — milestones only */}
      {isMilestone && (
        <div className="px-4 pb-3 -mt-1">
          <Progress value={Math.min(progress, 100)} className="h-1.5" />
        </div>
      )}

      {/* Expanded period grid */}
      {expanded && frequency && periods.length > 0 && (
        <div
          className="border-t border-border -mx-px px-4 pt-3 pb-2 overflow-x-auto"
          style={{ scrollbarWidth: "thin", scrollbarColor: "hsl(var(--border)) transparent" }}
        >
          <table className="w-full text-xs" style={{ minWidth: `${periods.length * 52}px` }}>
            <thead>
              <tr>
                {periods.map((key) => {
                  const isCurrent = key === currentPeriodKey
                  return (
                    <th
                      key={key}
                      className={cn("pb-2 text-center font-medium", isCurrent ? "text-primary" : "text-muted-foreground")}
                    >
                      <span className={cn(
                        "inline-flex items-center justify-center rounded-full px-1.5 py-0.5",
                        isCurrent && "bg-primary/10 font-semibold"
                      )}>
                        {formatPeriodKey(key, frequency)}
                      </span>
                    </th>
                  )
                })}
              </tr>
              {/* Target row for periodic goals */}
              {!isMilestone && (
                <tr>
                  {periods.map((key) => (
                    <td key={key} className="pb-1 text-center">
                      <span className="text-[10px] text-muted-foreground/40">
                        {goal.targetValue}
                      </span>
                    </td>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              <tr>
                {periods.map((key) => {
                  const isCurrent = key === currentPeriodKey
                  const isFuture = key > (currentPeriodKey ?? "")
                  return (
                    <td key={key} className={cn("text-center", isCurrent && "relative")}>
                      {isCurrent && (
                        <div className="pointer-events-none absolute inset-x-0 -bottom-1 -top-1 rounded-md border border-primary/30 bg-primary/5" />
                      )}
                      {isMilestone ? (
                        <MilestoneCell
                          periodKey={key}
                          value={goal.values[key] ?? 0}
                          isCurrent={isCurrent}
                          goalId={goal.id}
                          boardId={boardId}
                        />
                      ) : (
                        <PeriodicCell
                          periodKey={key}
                          value={goal.values[key] ?? 0}
                          target={goal.targetValue}
                          isCurrent={isCurrent}
                          isFuture={isFuture}
                          goalId={goal.id}
                          boardId={boardId}
                        />
                      )}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>

          {/* Summary below grid */}
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            {isMilestone && (
              <>
                <span>
                  Cumulative: <strong className="text-foreground">{cumulativeTotal}</strong>{" "}
                  / {goal.targetValue}{goal.valueType === "percentage" ? "%" : ""}
                </span>
                {goal.targetDate && (
                  <span>Due: {new Date(goal.targetDate).toLocaleDateString()}</span>
                )}
              </>
            )}
            {!isMilestone && periodicStats && (
              <span>
                On target: <strong className={cn(
                  periodicStats.tracked > 0 && periodicStats.onTarget === periodicStats.tracked
                    ? "text-primary"
                    : "text-foreground"
                )}>{periodicStats.onTarget}</strong>{" "}
                / {periodicStats.tracked} periods
              </span>
            )}
          </div>
        </div>
      )}

      {/* Expanded section when no frequency set */}
      {expanded && !frequency && (
        <div className="border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">
            No check-in frequency set. Edit this goal to configure reporting periods.
          </p>
        </div>
      )}

      {/* Actions (coach only) */}
      {expanded && isCoach && (
        <div className="flex items-center gap-2 border-t border-border px-4 py-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-xs"
            onClick={handlePriorityToggle}
          >
            {goal.isPriority ? (
              <>
                <StarOff className="h-3.5 w-3.5" />
                Remove priority
              </>
            ) : (
              <>
                <Star className="h-3.5 w-3.5" />
                Set as priority
              </>
            )}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-xs"
            onClick={() => setEditDialogOpen(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>

          <div className="flex-1" />

          {deleteConfirm ? (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-xs"
                onClick={() => deleteStandardGoal(boardId, goal.id)}
              >
                Delete
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setDeleteConfirm(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Mobile progress (shown in collapsed state) */}
      {!expanded && (
        <div className="flex sm:hidden items-center gap-3 px-4 pb-3 -mt-1">
          <Progress value={Math.min(progress, 100)} className="h-1.5 flex-1" />
          <span className="text-xs tabular-nums text-muted-foreground">{progress}%</span>
        </div>
      )}

      {/* Edit goal dialog */}
      {isCoach && (
        <AddStandardGoalDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          boardId={boardId}
          editGoal={goal}
        />
      )}
    </div>
  )
}
