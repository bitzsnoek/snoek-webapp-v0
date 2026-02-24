"use client"

import type { Quarter, Year } from "@/lib/mock-data"
import { getProgressPercent } from "@/lib/mock-data"
import { KeyResultCard } from "./key-result-card"
import { Target, TrendingUp, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

export function QuarterlyGoals({
  quarters,
  years,
}: {
  quarters: Quarter[]
  years: Year[]
}) {
  if (quarters.length === 0) {
    return (
      <div className="mx-auto max-w-5xl">
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
      <Tabs defaultValue={quarters[0].id}>
        {quarters.length > 1 && (
          <div className="mb-6 flex items-center justify-between">
            <TabsList>
              {quarters.map((q) => (
                <TabsTrigger key={q.id} value={q.id}>
                  {q.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Goal
            </Button>
          </div>
        )}

        {quarters.length === 1 && (
          <div className="mb-6 flex items-center justify-end">
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Goal
            </Button>
          </div>
        )}

        {quarters.map((quarter) => {
          // Group quarterly goals by their parent yearly goal
          const goalsByYearlyGoal = groupByYearlyGoal(quarter, years)

          return (
            <TabsContent key={quarter.id} value={quarter.id}>
              <div className="flex flex-col gap-8">
                {goalsByYearlyGoal.map((group) => (
                  <YearlyGoalGroup key={group.yearlyGoalId} group={group} />
                ))}
              </div>
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}

// ---- Grouping logic ----

interface YearlyGoalGroupData {
  yearlyGoalId: string
  yearlyObjective: string
  yearlyKeyResults: string[]
  yearlyGoalProgress: number
  quarterlyGoals: {
    goal: Quarter["goals"][number]
    avgProgress: number
  }[]
}

function groupByYearlyGoal(quarter: Quarter, years: Year[]): YearlyGoalGroupData[] {
  // Build a lookup from yearly goal id -> yearly goal
  const yearlyGoalMap = new Map<string, Year["goals"][number]>()
  for (const year of years) {
    for (const yg of year.goals) {
      yearlyGoalMap.set(yg.id, yg)
    }
  }

  // Group quarterly goals by yearlyGoalId
  const groups = new Map<string, Quarter["goals"]>()
  const ungrouped: Quarter["goals"] = []

  for (const qg of quarter.goals) {
    if (qg.yearlyGoalId && yearlyGoalMap.has(qg.yearlyGoalId)) {
      const existing = groups.get(qg.yearlyGoalId) || []
      existing.push(qg)
      groups.set(qg.yearlyGoalId, existing)
    } else {
      ungrouped.push(qg)
    }
  }

  const result: YearlyGoalGroupData[] = []

  for (const [yearlyGoalId, quarterlyGoals] of groups) {
    const yg = yearlyGoalMap.get(yearlyGoalId)!
    const qGoalsWithProgress = quarterlyGoals.map((qg) => {
      const allProgress = qg.keyResults.map((kr) => getProgressPercent(kr))
      const avgProgress =
        allProgress.length > 0
          ? Math.round(allProgress.reduce((a, b) => a + b, 0) / allProgress.length)
          : 0
      return { goal: qg, avgProgress }
    })

    // Overall yearly goal progress = average of all quarterly goal averages
    const yearlyGoalProgress =
      qGoalsWithProgress.length > 0
        ? Math.round(
            qGoalsWithProgress.reduce((a, b) => a + b.avgProgress, 0) /
              qGoalsWithProgress.length
          )
        : 0

    result.push({
      yearlyGoalId,
      yearlyObjective: yg.objective,
      yearlyKeyResults: yg.keyResults,
      yearlyGoalProgress,
      quarterlyGoals: qGoalsWithProgress,
    })
  }

  // Ungrouped quarterly goals (no parent yearly goal)
  if (ungrouped.length > 0) {
    const qGoalsWithProgress = ungrouped.map((qg) => {
      const allProgress = qg.keyResults.map((kr) => getProgressPercent(kr))
      const avgProgress =
        allProgress.length > 0
          ? Math.round(allProgress.reduce((a, b) => a + b, 0) / allProgress.length)
          : 0
      return { goal: qg, avgProgress }
    })
    result.push({
      yearlyGoalId: "_ungrouped",
      yearlyObjective: "Other Goals",
      yearlyKeyResults: [],
      yearlyGoalProgress: 0,
      quarterlyGoals: qGoalsWithProgress,
    })
  }

  return result
}

// ---- Components ----

function YearlyGoalGroup({ group }: { group: YearlyGoalGroupData }) {
  return (
    <div>
      {/* Yearly goal header */}
      <div className="mb-4 flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Target className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {group.yearlyObjective}
              </h2>
              {group.yearlyKeyResults.length > 0 && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {group.yearlyKeyResults.join(" / ")}
                </p>
              )}
            </div>
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 tabular-nums text-xs",
                group.yearlyGoalProgress >= 75
                  ? "border-primary/30 text-primary"
                  : group.yearlyGoalProgress >= 50
                  ? "border-chart-3/30 text-chart-3"
                  : "text-muted-foreground"
              )}
            >
              {group.yearlyGoalProgress}%
            </Badge>
          </div>
          <Progress
            value={Math.min(group.yearlyGoalProgress, 100)}
            className="mt-2 h-1"
          />
        </div>
      </div>

      {/* Quarterly goals nested under this yearly goal */}
      <div className="ml-5 border-l border-border pl-6 flex flex-col gap-5">
        {group.quarterlyGoals.map(({ goal, avgProgress }) => (
          <div
            key={goal.id}
            className="rounded-xl border border-border bg-card p-5"
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-chart-2/10">
                  <TrendingUp className="h-3.5 w-3.5 text-chart-2" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {goal.objective}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {goal.keyResults.length} key result{goal.keyResults.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs tabular-nums">
                {avgProgress}% avg
              </Badge>
            </div>

            <div className="flex flex-col gap-3">
              {goal.keyResults.map((kr) => (
                <KeyResultCard key={kr.id} kr={kr} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
