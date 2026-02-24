"use client"

import type { Quarter } from "@/lib/mock-data"
import { getProgressPercent } from "@/lib/mock-data"
import { KeyResultCard } from "./key-result-card"
import { TrendingUp, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

export function QuarterlyGoals({ quarters }: { quarters: Quarter[] }) {
  if (quarters.length === 0) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Quarterly Goals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Quarterly objectives broken down into measurable key results
          </p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
          <TrendingUp className="mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            No active quarterly goals yet
          </p>
          <Button variant="outline" size="sm" className="mt-4 gap-2">
            <Plus className="h-4 w-4" />
            Create quarterly goals
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Quarterly Goals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Quarterly objectives broken down into measurable key results
          </p>
        </div>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Goal
        </Button>
      </div>

      <Tabs defaultValue={quarters[0].id}>
        {quarters.length > 1 && (
          <TabsList className="mb-6">
            {quarters.map((q) => (
              <TabsTrigger key={q.id} value={q.id}>
                {q.label}
              </TabsTrigger>
            ))}
          </TabsList>
        )}

        {quarters.map((quarter) => (
          <TabsContent key={quarter.id} value={quarter.id}>
            <div className="flex flex-col gap-6">
              {quarter.goals.map((goal) => {
                const allProgress = goal.keyResults.map((kr) =>
                  getProgressPercent(kr)
                )
                const avgProgress =
                  allProgress.length > 0
                    ? Math.round(
                        allProgress.reduce((a, b) => a + b, 0) /
                          allProgress.length
                      )
                    : 0

                return (
                  <div
                    key={goal.id}
                    className="rounded-xl border border-border bg-card p-5"
                  >
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <TrendingUp className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-foreground">
                            {goal.objective}
                          </h3>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {goal.keyResults.length} key results
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {avgProgress}% avg
                      </Badge>
                    </div>

                    <div className="flex flex-col gap-3">
                      {goal.keyResults.map((kr) => (
                        <KeyResultCard key={kr.id} kr={kr} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
