"use client"

import { useApp } from "@/lib/store"
import { getMonthlyPriorities, getProgressPercent, sumWeeklyValues } from "@/lib/mock-data"
import { Flame, ArrowUpRight, ArrowDownRight, FolderKanban } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

const typeIcons = {
  input: ArrowUpRight,
  output: ArrowDownRight,
  project: FolderKanban,
}

export function MonthlyPriorities() {
  const { activeCompany } = useApp()
  const priorities = getMonthlyPriorities(activeCompany)

  // Group by owner
  const byOwner: Record<string, typeof priorities> = {}
  for (const p of priorities) {
    if (!byOwner[p.keyResult.owner]) byOwner[p.keyResult.owner] = []
    byOwner[p.keyResult.owner].push(p)
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">
            Monthly Priorities
          </h1>
          <Badge className="bg-chart-3/10 text-chart-3 border-chart-3/20">
            {priorities.length} active
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Key results that founders are actively working on and reporting weekly
        </p>
      </div>

      {Object.entries(byOwner).map(([owner, items]) => {
        const initials = owner
          .split(" ")
          .map((n) => n[0])
          .join("")

        return (
          <div key={owner} className="mb-8">
            <div className="mb-3 flex items-center gap-2.5">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-secondary text-xs text-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-sm font-semibold text-foreground">{owner}</h2>
              <span className="text-xs text-muted-foreground">
                {items.length} priorities
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {items.map(({ goal, keyResult: kr }) => {
                const progress = getProgressPercent(kr)
                const total = sumWeeklyValues(kr)
                const TypeIcon = typeIcons[kr.type]

                // Get last 4 weeks with values
                const weeks = Object.entries(kr.weeklyValues)
                  .sort(
                    ([a], [b]) =>
                      parseInt(a.replace("W", "")) -
                      parseInt(b.replace("W", ""))
                  )
                  .filter(([, v]) => v > 0)
                  .slice(-4)

                return (
                  <div
                    key={kr.id}
                    className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/20"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Flame className="h-3.5 w-3.5 text-chart-3" />
                          <p className="text-sm font-medium text-foreground">
                            {kr.title}
                          </p>
                        </div>
                        <p className="mt-0.5 ml-5.5 text-xs text-muted-foreground">
                          {goal.objective}
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        {/* Mini sparkline of recent weeks */}
                        <div className="hidden items-end gap-0.5 sm:flex">
                          {weeks.map(([week, value]) => {
                            const maxVal = Math.max(
                              ...weeks.map(([, v]) => v)
                            )
                            const height = maxVal > 0 ? (value / maxVal) * 24 : 0
                            return (
                              <div
                                key={week}
                                className="w-2 rounded-sm bg-primary/40"
                                style={{ height: `${Math.max(height, 3)}px` }}
                                title={`${week}: ${value}`}
                              />
                            )
                          })}
                        </div>

                        <div className="text-right">
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
                            {kr.type === "project"
                              ? `${progress}%`
                              : `${total}/${kr.target}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3">
                      <Progress
                        value={Math.min(progress, 100)}
                        className="h-1.5"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {priorities.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
          <Flame className="mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            No monthly priorities set yet
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Mark key results as monthly priorities in the quarterly goals view
          </p>
        </div>
      )}
    </div>
  )
}
