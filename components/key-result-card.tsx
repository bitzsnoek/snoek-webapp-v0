"use client"

import { useState, useRef, useCallback } from "react"
import type { KeyResult } from "@/lib/mock-data"
import { getProgressPercent, sumWeeklyValues, getCurrentWeekKey } from "@/lib/mock-data"
import { useApp } from "@/lib/store"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import {
  ArrowUpRight,
  ArrowDownRight,
  FolderKanban,
  ChevronDown,
  ChevronUp,
  Flame,
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
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value || ""))
  const inputRef = useRef<HTMLInputElement>(null)

  const commit = useCallback(() => {
    setEditing(false)
    const parsed = parseInt(draft, 10)
    const newVal = isNaN(parsed) || parsed < 0 ? 0 : parsed
    if (newVal !== value) {
      updateWeeklyValue(krId, week, newVal)
    }
    setDraft(String(newVal || ""))
  }, [draft, value, krId, week, updateWeeklyValue])

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
          if (e.key === "Escape") {
            setDraft(String(value || ""))
            setEditing(false)
          }
          if (e.key === "Tab") {
            // Allow natural tab; commit happens on blur
          }
        }}
        autoFocus
        className="h-7 w-12 rounded-md border border-ring bg-background text-center text-xs text-foreground outline-none ring-1 ring-ring/30 focus:ring-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    )
  }

  return (
    <button
      onClick={() => {
        setDraft(String(value || ""))
        setEditing(true)
      }}
      className={cn(
        "inline-flex h-7 w-12 items-center justify-center rounded-md text-xs transition-colors cursor-text",
        value > 0
          ? "bg-primary/10 font-medium text-primary hover:bg-primary/20"
          : "text-muted-foreground/50 hover:bg-secondary hover:text-muted-foreground"
      )}
      title={`Click to edit ${week}`}
    >
      {value || "-"}
    </button>
  )
}

export function KeyResultCard({ kr }: { kr: KeyResult }) {
  const [expanded, setExpanded] = useState(false)
  const progress = getProgressPercent(kr)
  const total = sumWeeklyValues(kr)
  const config = typeConfig[kr.type]
  const TypeIcon = config.icon

  const ownerInitials = kr.owner
    .split(" ")
    .map((n) => n[0])
    .join("")

  const currentWeek = getCurrentWeekKey()
  const weeks = Object.keys(kr.weeklyValues).sort(
    (a, b) => parseInt(a.replace("W", "")) - parseInt(b.replace("W", ""))
  )

  return (
    <div className="rounded-lg border border-border bg-background/50 p-4 transition-colors hover:border-border/80">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
              config.bgColor
            )}
          >
            <TypeIcon className={cn("h-3.5 w-3.5", config.color)} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground">{kr.title}</p>
              {kr.isMonthlyPriority && (
                <Flame className="h-3.5 w-3.5 text-chart-3" />
              )}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn("text-xs", config.color)}
              >
                {config.label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {kr.type === "project"
                  ? `${progress}% complete`
                  : `${total} / ${kr.target}`}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="bg-secondary text-[10px] text-foreground">
              {ownerInitials}
            </AvatarFallback>
          </Avatar>

          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-sm font-semibold",
                progress >= 75
                  ? "text-primary"
                  : progress >= 50
                  ? "text-chart-3"
                  : "text-muted-foreground"
              )}
            >
              {progress}%
            </span>
          </div>

          <button
            onClick={() => setExpanded(!expanded)}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <Progress
          value={Math.min(progress, 100)}
          className="h-1.5"
        />
      </div>

      {/* Expanded weekly values */}
      {expanded && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                {weeks.map((week) => {
                  const isCurrent = week === currentWeek
                  return (
                    <th
                      key={week}
                      className={cn(
                        "pb-2 text-center font-medium",
                        isCurrent
                          ? "text-primary"
                          : "text-muted-foreground"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex items-center justify-center rounded-full px-1.5 py-0.5",
                          isCurrent && "bg-primary/10 font-semibold"
                        )}
                      >
                        {week}
                      </span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              <tr>
                {weeks.map((week) => {
                  const isCurrent = week === currentWeek
                  return (
                    <td
                      key={week}
                      className={cn(
                        "text-center",
                        isCurrent && "relative"
                      )}
                    >
                      {isCurrent && (
                        <div className="absolute inset-x-0 -top-1 -bottom-1 rounded-md border border-primary/30 bg-primary/5 pointer-events-none" />
                      )}
                      <EditableCell
                        week={week}
                        value={kr.weeklyValues[week] ?? 0}
                        krId={kr.id}
                      />
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
