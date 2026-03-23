"use client"

import { useState } from "react"
import type { Quarter, Year, QuarterlyGoal } from "@/lib/mock-data"
import { getProgressPercent } from "@/lib/mock-data"
import { useApp } from "@/lib/store"
import { KeyResultCard } from "./key-result-card"
import { GoalDialog } from "./goal-dialog"
import { TrendingUp, Plus, Target, Pencil, ChevronUp, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

export function QuarterlyGoals({
  quarters,
  years,
}: {
  quarters: Quarter[]
  years: Year[]
}) {
  const { reorderQuarterlyGoals, reorderQuarterlyKeyResults } = useApp()
  const [dialogState, setDialogState] = useState<{
    quarterId: string
    goal?: QuarterlyGoal
  } | null>(null)

  if (quarters.length === 0) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
          <TrendingUp className="mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No active quarterly goals yet</p>
        </div>
      </div>
    )
  }

  return (
    <>
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
              <Button
                size="sm"
                className="gap-2"
                onClick={() => setDialogState({ quarterId: quarters[0].id })}
              >
                <Plus className="h-4 w-4" />
                Add Goal
              </Button>
            </div>
          )}

          {quarters.length === 1 && (
            <div className="mb-6 flex items-center justify-end">
              <Button
                size="sm"
                className="gap-2"
                onClick={() => setDialogState({ quarterId: quarters[0].id })}
              >
                <Plus className="h-4 w-4" />
                Add Goal
              </Button>
            </div>
          )}

          {quarters.map((quarter) => {
            const groups = groupByYearlyGoal(quarter, years)
            return (
              <TabsContent key={quarter.id} value={quarter.id}>
                <div className="flex flex-col gap-8">
                  {groups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
                      <TrendingUp className="mb-3 h-8 w-8 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">No goals yet for {quarter.label}</p>
                      <button
                        onClick={() => setDialogState({ quarterId: quarter.id })}
                        className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add first goal
                      </button>
                    </div>
                  ) : (
                    groups.map((group) => (
                      <YearlyGoalGroup
                        key={group.yearlyGoalId}
                        group={group}
                        quarterId={quarter.id}
                        allGoals={quarter.goals}
                        onEdit={(goal) => setDialogState({ quarterId: quarter.id, goal })}
                        onAdd={() => setDialogState({ quarterId: quarter.id })}
                        onReorderGoal={(fromIndex, toIndex) => reorderQuarterlyGoals(quarter.id, fromIndex, toIndex)}
                        onReorderKeyResult={(goalId, fromIndex, toIndex) => reorderQuarterlyKeyResults(quarter.id, goalId, fromIndex, toIndex)}
                      />
                    ))
                  )}
                </div>
              </TabsContent>
            )
          })}
        </Tabs>
      </div>

      {dialogState && (
        <GoalDialog
          quarterId={dialogState.quarterId}
          years={years}
          goal={dialogState.goal}
          onClose={() => setDialogState(null)}
        />
      )}
    </>
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
  const yearlyGoalMap = new Map<string, Year["goals"][number] & { year: number }>()
  for (const year of years) {
    for (const yg of year.goals) {
      yearlyGoalMap.set(yg.id, { ...yg, year: year.year })
    }
  }

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

    const yearlyGoalProgress =
      qGoalsWithProgress.length > 0
        ? Math.round(qGoalsWithProgress.reduce((a, b) => a + b.avgProgress, 0) / qGoalsWithProgress.length)
        : 0

    result.push({
      yearlyGoalId,
      yearlyObjective: yg.objective,
      yearlyKeyResults: yg.keyResults,
      yearlyGoalProgress,
      quarterlyGoals: qGoalsWithProgress,
    })
  }

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

function YearlyGoalGroup({
  group,
  quarterId,
  allGoals,
  onEdit,
  onAdd,
  onReorderGoal,
  onReorderKeyResult,
}: {
  group: YearlyGoalGroupData
  quarterId: string
  allGoals: QuarterlyGoal[]
  onEdit: (goal: QuarterlyGoal) => void
  onAdd: () => void
  onReorderGoal: (fromIndex: number, toIndex: number) => void
  onReorderKeyResult: (goalId: string, fromIndex: number, toIndex: number) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Target className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
        <span className="text-sm font-semibold text-muted-foreground/60">
          {group.yearlyObjective}
        </span>
        <div className="h-px flex-1 bg-border/50" />
      </div>

      <div className="flex flex-col gap-5">
        {group.quarterlyGoals.map(({ goal }) => {
          // Find the index in the full list of quarterly goals
          const goalIndex = allGoals.findIndex((g) => g.id === goal.id)
          return (
            <div key={goal.id} className="group/goal rounded-xl border border-border bg-card p-4 md:p-5">
              <div className="mb-4 flex items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                  {/* Goal reorder controls */}
                  <div className="flex flex-col gap-0.5 -ml-1 mr-1">
                    <button
                      onClick={() => onReorderGoal(goalIndex, goalIndex - 1)}
                      disabled={goalIndex === 0}
                      className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/40 transition-colors hover:bg-secondary hover:text-muted-foreground disabled:opacity-20 disabled:pointer-events-none"
                      title="Move up"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => onReorderGoal(goalIndex, goalIndex + 1)}
                      disabled={goalIndex === allGoals.length - 1}
                      className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/40 transition-colors hover:bg-secondary hover:text-muted-foreground disabled:opacity-20 disabled:pointer-events-none"
                      title="Move down"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-chart-2/10">
                    <TrendingUp className="h-3.5 w-3.5 text-chart-2" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{goal.objective}</h3>
                </div>
                <button
                  onClick={() => onEdit(goal)}
                  className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground md:opacity-0 transition-opacity hover:text-foreground md:group-hover/goal:opacity-100"
                  title="Edit goal"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {goal.keyResults.map((kr, krIndex) => (
                  <div key={kr.id} className="flex items-start gap-2">
                    {/* KR reorder controls */}
                    <div className="flex flex-col gap-0.5 pt-3">
                      <button
                        onClick={() => onReorderKeyResult(goal.id, krIndex, krIndex - 1)}
                        disabled={krIndex === 0}
                        className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground/30 transition-colors hover:bg-secondary hover:text-muted-foreground disabled:opacity-20 disabled:pointer-events-none"
                        title="Move up"
                      >
                        <ChevronUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => onReorderKeyResult(goal.id, krIndex, krIndex + 1)}
                        disabled={krIndex === goal.keyResults.length - 1}
                        className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground/30 transition-colors hover:bg-secondary hover:text-muted-foreground disabled:opacity-20 disabled:pointer-events-none"
                        title="Move down"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex-1">
                      <KeyResultCard kr={kr} quarterId={quarterId} goalId={goal.id} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
