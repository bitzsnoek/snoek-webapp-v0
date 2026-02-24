"use client"

import type { Year } from "@/lib/mock-data"
import { Target, Plus, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export function YearlyGoals({ years }: { years: Year[] }) {
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
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-lg font-semibold text-foreground">{year.year}</h2>
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              Active
            </Badge>
          </div>

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
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      {goal.objective}
                    </h3>
                  </div>
                </div>

                <div className="ml-11 flex flex-col gap-2">
                  {goal.keyResults.map((kr, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2.5 text-sm text-muted-foreground"
                    >
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                      <span>{kr}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {years.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
          <Target className="mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            No active yearly goals yet
          </p>
          <Button variant="outline" size="sm" className="mt-4 gap-2">
            <Plus className="h-4 w-4" />
            Create your first yearly goal
          </Button>
        </div>
      )}
    </div>
  )
}
