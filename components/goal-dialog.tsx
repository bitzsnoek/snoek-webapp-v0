"use client"

import { useState } from "react"
import { useApp } from "@/lib/store"
import type { QuarterlyGoal, KeyResult, KeyResultType, Year } from "@/lib/mock-data"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Trash2, Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface GoalDialogProps {
  quarterId: string
  years: Year[]
  /** Existing goal to edit — undefined means "add new" */
  goal?: QuarterlyGoal
  onClose: () => void
}

const WEEKS = Array.from({ length: 13 }, (_, i) => `W${i + 1}`)

const emptyKr = (): Omit<KeyResult, "id"> => ({
  title: "",
  type: "output",
  owner: "",
  isMonthlyPriority: false,
  target: 0,
  weeklyValues: Object.fromEntries(WEEKS.map((w) => [w, 0])),
})

export function GoalDialog({ quarterId, years, goal, onClose }: GoalDialogProps) {
  const { activeCompany, addQuarterlyGoal, updateQuarterlyGoal, addKeyResult, updateKeyResult, deleteKeyResult, deleteQuarterlyGoal, refreshData } = useApp()

  const [objective, setObjective] = useState(goal?.objective ?? "")
  const [yearlyGoalId, setYearlyGoalId] = useState(goal?.yearlyGoalId ?? "")
  const [keyResults, setKeyResults] = useState<(Omit<KeyResult, "id"> & { id?: string })[]>(
    goal?.keyResults.length
      ? goal.keyResults.map(({ id, ...rest }) => ({ id, ...rest }))
      : [emptyKr()]
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // All yearly goals across all active years
  const allYearlyGoals = years.flatMap((y) => y.goals.map((g) => ({ ...g, year: y.year })))

  function validate() {
    const e: Record<string, string> = {}
    if (!objective.trim()) e.objective = "Objective is required"
    keyResults.forEach((kr, i) => {
      if (!kr.title.trim()) e[`kr_${i}_title`] = "Title required"
      if (kr.target <= 0) e[`kr_${i}_target`] = "Target must be > 0"
    })
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (saving) return
    if (!validate()) return
    setSaving(true)
    try {
    if (goal) {
      // Update existing goal objective + yearly goal link
      updateQuarterlyGoal(quarterId, goal.id, objective.trim(), yearlyGoalId)
      // Sync key results: update existing, add new, delete removed
      const existingIds = new Set(goal.keyResults.map((k) => k.id))
      const keptIds = new Set<string>()
      for (const kr of keyResults) {
        if (kr.id && existingIds.has(kr.id)) {
          const { id, ...rest } = kr as KeyResult
          updateKeyResult(quarterId, goal.id, id, rest)
          keptIds.add(id)
        } else {
          const { id: _id, ...rest } = kr as KeyResult
          await addKeyResult(quarterId, goal.id, rest)
        }
      }
      for (const id of existingIds) {
        if (!keptIds.has(id)) deleteKeyResult(quarterId, goal.id, id)
      }
    } else {
      // Await goal creation to get the real DB ID before adding key results
      const newGoalId = await addQuarterlyGoal(quarterId, objective.trim(), yearlyGoalId)
      for (const kr of keyResults) {
        const { id: _id, ...rest } = kr as KeyResult
        await addKeyResult(quarterId, newGoalId, rest)
      }
    }
    // Refresh after all mutations are done
    await refreshData()
    onClose()
    } finally {
      setSaving(false)
    }
  }

  function handleDelete() {
    if (!goal) return
    deleteQuarterlyGoal(quarterId, goal.id)
    onClose()
  }

  function updateKr(i: number, patch: Partial<Omit<KeyResult, "id">>) {
    setKeyResults((prev) => prev.map((kr, idx) => idx === i ? { ...kr, ...patch } : kr))
  }

  function removeKr(i: number) {
    setKeyResults((prev) => prev.filter((_, idx) => idx !== i))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={saving ? undefined : onClose} />

      {/* Panel */}
      <div className="relative z-10 mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">
            {goal ? "Edit Goal" : "Add Goal"}
          </h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Objective */}
          <div className="space-y-1.5">
            <Label htmlFor="objective">Objective</Label>
            <Input
              id="objective"
              placeholder="e.g. Accelerate sales pipeline"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              className={cn(errors.objective && "border-destructive")}
            />
            {errors.objective && <p className="text-xs text-destructive">{errors.objective}</p>}
          </div>

          {/* Yearly goal link */}
          <div className="space-y-1.5">
            <Label>Linked Yearly Goal</Label>
            <Select value={yearlyGoalId || "_none"} onValueChange={(v) => setYearlyGoalId(v === "_none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="No yearly goal linked" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">No yearly goal</SelectItem>
                {allYearlyGoals.map((yg) => (
                  <SelectItem key={yg.id} value={yg.id}>
                    <span className="text-muted-foreground text-xs mr-1">{yg.year}</span>
                    {yg.objective}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Key results */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Key Results</Label>
            </div>

            {keyResults.map((kr, i) => (
              <div key={i} className="rounded-lg border border-border bg-background p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-1.5">
                    <Input
                      placeholder="Key result title"
                      value={kr.title}
                      onChange={(e) => updateKr(i, { title: e.target.value })}
                      className={cn("text-sm", errors[`kr_${i}_title`] && "border-destructive")}
                    />
                    {errors[`kr_${i}_title`] && <p className="text-xs text-destructive">{errors[`kr_${i}_title`]}</p>}
                  </div>
                  <button
                    onClick={() => removeKr(i)}
                    disabled={keyResults.length === 1}
                    className="mt-1 rounded-md p-1.5 text-muted-foreground hover:text-destructive disabled:opacity-30"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {/* Type */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Type</Label>
                    <Select value={kr.type} onValueChange={(v) => updateKr(i, { type: v as KeyResultType })}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="input">Input</SelectItem>
                        <SelectItem value="output">Output</SelectItem>
                        <SelectItem value="project">Project</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Owner */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Owner</Label>
                    <Select
                      value={kr.owner || "_unassigned"}
                      onValueChange={(v) => updateKr(i, { owner: v === "_unassigned" ? "" : v })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_unassigned">Unassigned</SelectItem>
                        {activeCompany.members.map((member) => (
                          <SelectItem key={member.id} value={member.name}>
                            {member.name}
                            <span className="ml-1 text-muted-foreground capitalize">({member.role})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Target */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      {kr.type === "input" ? "Weekly target" : kr.type === "project" ? "Target (%)" : "Quarterly target"}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={kr.target || ""}
                      onChange={(e) => updateKr(i, { target: parseInt(e.target.value) || 0 })}
                      className={cn("h-8 text-xs", errors[`kr_${i}_target`] && "border-destructive")}
                    />
                    {errors[`kr_${i}_target`] && <p className="text-xs text-destructive">{errors[`kr_${i}_target`]}</p>}
                  </div>
                </div>

                {/* Monthly priority toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={kr.isMonthlyPriority}
                    onChange={(e) => updateKr(i, { isMonthlyPriority: e.target.checked })}
                    className="h-3.5 w-3.5 rounded border-border accent-primary"
                  />
                  <span className="text-xs text-muted-foreground">Show in monthly priorities</span>
                </label>
              </div>
            ))}

            <button
              onClick={() => setKeyResults((prev) => [...prev, emptyKr()])}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2.5 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add key result
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          {goal ? (
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete goal
            </button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : goal ? "Save changes" : "Add goal"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
