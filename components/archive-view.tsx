"use client"

import { useApp } from "@/lib/store"
import { getArchivedYears, getArchivedQuarters, getProgressPercent } from "@/lib/mock-data"
import { Archive, Target, TrendingUp, CheckCircle2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function ArchiveView() {
  const { activeCompany } = useApp()
  const archivedYears = getArchivedYears(activeCompany)
  const archivedQuarters = getArchivedQuarters(activeCompany)

  const isEmpty = archivedYears.length === 0 && archivedQuarters.length === 0

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Archive</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Past years and quarters that are no longer active
        </p>
      </div>

      {/* Archived Years */}
      {archivedYears.length > 0 && (
        <div className="mb-10">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Archived Years
          </h2>
          <div className="flex flex-col gap-4">
            {archivedYears.map((year) => (
              <div
                key={year.id}
                className="rounded-xl border border-border bg-card p-5 opacity-75"
              >
                <div className="mb-3 flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-foreground">
                    {year.year}
                  </h3>
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    Archived
                  </Badge>
                </div>
                <div className="flex flex-col gap-3">
                  {year.goals.map((goal) => (
                    <div key={goal.id} className="flex items-start gap-3">
                      <Target className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
                      <div>
                        <p className="text-sm font-medium text-foreground/80">
                          {goal.objective}
                        </p>
                        <div className="mt-1 flex flex-col gap-1">
                          {goal.keyResults.map((kr, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 text-xs text-muted-foreground"
                            >
                              <CheckCircle2 className="h-3 w-3 shrink-0" />
                              <span>{kr}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Archived Quarters */}
      {archivedQuarters.length > 0 && (
        <div className="mb-10">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Archived Quarters
          </h2>
          <div className="flex flex-col gap-4">
            {archivedQuarters.map((quarter) => (
              <div
                key={quarter.id}
                className="rounded-xl border border-border bg-card p-5 opacity-75"
              >
                <div className="mb-3 flex items-center gap-3">
                  <h3 className="text-base font-semibold text-foreground">
                    {quarter.label}
                  </h3>
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    Archived
                  </Badge>
                </div>
                <div className="flex flex-col gap-3">
                  {quarter.goals.map((goal) => (
                    <div key={goal.id}>
                      <div className="mb-2 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-muted-foreground/50" />
                        <p className="text-sm font-medium text-foreground/80">
                          {goal.objective}
                        </p>
                      </div>
                      <div className="ml-6 flex flex-col gap-1.5">
                        {goal.keyResults.map((kr) => {
                          const progress = getProgressPercent(kr)
                          return (
                            <div
                              key={kr.id}
                              className="flex items-center justify-between text-xs"
                            >
                              <span className="text-muted-foreground">
                                {kr.title}
                              </span>
                              <span
                                className={cn(
                                  "font-medium",
                                  progress >= 75
                                    ? "text-primary"
                                    : "text-muted-foreground"
                                )}
                              >
                                {progress}%
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isEmpty && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
          <Archive className="mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            No archived items yet
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Years and quarters will appear here when archived
          </p>
        </div>
      )}
    </div>
  )
}
