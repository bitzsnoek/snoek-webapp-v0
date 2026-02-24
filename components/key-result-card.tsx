"use client"

import { useState } from "react"
import type { KeyResult } from "@/lib/mock-data"
import { getProgressPercent, sumWeeklyValues } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import {
  ArrowUpRight,
  ArrowDownRight,
  Zap,
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
                {weeks.map((week) => (
                  <th
                    key={week}
                    className="pb-2 text-center font-medium text-muted-foreground"
                  >
                    {week}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {weeks.map((week) => (
                  <td key={week} className="text-center">
                    <span
                      className={cn(
                        "inline-flex h-7 w-10 items-center justify-center rounded-md text-xs",
                        kr.weeklyValues[week] > 0
                          ? "bg-primary/10 font-medium text-primary"
                          : "text-muted-foreground/50"
                      )}
                    >
                      {kr.weeklyValues[week] || "-"}
                    </span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
