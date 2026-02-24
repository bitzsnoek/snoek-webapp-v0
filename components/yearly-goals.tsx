"use client"

import type { Year, Confidence } from "@/lib/mock-data"
import { useApp } from "@/lib/store"
import { Target, Plus, Circle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const CONFIDENCE_OPTIONS: {
  value: Confidence
  label: string
  color: string
  dot: string
}[] = [
  {
    value: "not_started",
    label: "Not started",
    color: "text-muted-foreground",
    dot: "bg-muted-foreground/40",
  },
  {
    value: "confident",
    label: "Confident",
    color: "text-emerald-400",
    dot: "bg-emerald-400",
  },
  {
    value: "moderately_confident",
    label: "Moderately confident",
    color: "text-amber-400",
    dot: "bg-amber-400",
  },
  {
    value: "not_confident",
    label: "Not confident",
    color: "text-red-400",
    dot: "bg-red-400",
  },
  {
    value: "done",
    label: "Done",
    color: "text-sky-400",
    dot: "bg-sky-400",
  },
  {
    value: "discontinued",
    label: "Discontinued",
    color: "text-muted-foreground/60",
    dot: "bg-muted-foreground/30",
  },
]

function getOption(confidence: Confidence) {
  return CONFIDENCE_OPTIONS.find((o) => o.value === confidence) ?? CONFIDENCE_OPTIONS[0]
}

export function YearlyGoals({ years }: { years: Year[] }) {
  const { updateYearlyKRConfidence } = useApp()

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Yearly Goals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Long-term objectives and key results for the year
          </p>
        </div>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Goal
        </Button>
      </div>

      {years.map((year) => (
        <div key={year.id} className="mb-10">
          <div className="flex flex-col gap-4">
            {year.goals.map((goal) => (
              <div
                key={goal.id}
                className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/30"
              >
                <div className="mb-4 flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Target className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">
                    {goal.objective}
                  </h3>
                </div>

                <div className="ml-11 flex flex-col gap-1.5">
                  {goal.keyResults.map((kr) => {
                    const option = getOption(kr.confidence)
                    return (
                      <div
                        key={kr.id}
                        className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-secondary/50"
                      >
                        <div className="flex items-center gap-2.5 text-sm text-foreground/80">
                          <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30" />
                          <span className={cn(kr.confidence === "discontinued" && "line-through text-muted-foreground/50")}>
                            {kr.title}
                          </span>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className={cn(
                                "flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium transition-colors hover:bg-secondary",
                                option.color
                              )}
                            >
                              <span
                                className={cn("h-1.5 w-1.5 rounded-full", option.dot)}
                              />
                              {option.label}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" sideOffset={4}>
                            {CONFIDENCE_OPTIONS.map((opt) => (
                              <DropdownMenuItem
                                key={opt.value}
                                onClick={() =>
                                  updateYearlyKRConfidence(year.id, goal.id, kr.id, opt.value)
                                }
                                className="gap-2"
                              >
                                <span
                                  className={cn("h-2 w-2 rounded-full", opt.dot)}
                                />
                                <span className={cn("text-sm", opt.color)}>
                                  {opt.label}
                                </span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {years.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
          <Target className="mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No active yearly goals yet</p>
          <Button variant="outline" size="sm" className="mt-4 gap-2">
            <Plus className="h-4 w-4" />
            Create your first yearly goal
          </Button>
        </div>
      )}
    </div>
  )
}
