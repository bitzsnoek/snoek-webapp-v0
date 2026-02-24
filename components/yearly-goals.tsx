"use client"

import { useState } from "react"
import type { Year, YearlyGoal, Confidence } from "@/lib/mock-data"
import { useApp } from "@/lib/store"
import { Target, Plus, Circle, Pencil, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

// ── Confidence config ────────────────────────────────────────────────────────

const CONFIDENCE_OPTIONS: {
  value: Confidence
  label: string
  color: string
  dot: string
}[] = [
  { value: "not_started",         label: "Not started",         color: "text-muted-foreground",    dot: "bg-muted-foreground/40" },
  { value: "confident",           label: "Confident",           color: "text-emerald-400",          dot: "bg-emerald-400" },
  { value: "moderately_confident",label: "Moderately confident",color: "text-amber-400",            dot: "bg-amber-400" },
  { value: "not_confident",       label: "Not confident",       color: "text-red-400",              dot: "bg-red-400" },
  { value: "done",                label: "Done",                color: "text-sky-400",              dot: "bg-sky-400" },
  { value: "discontinued",        label: "Discontinued",        color: "text-muted-foreground/60",  dot: "bg-muted-foreground/30" },
]

function getOption(confidence: Confidence) {
  return CONFIDENCE_OPTIONS.find((o) => o.value === confidence) ?? CONFIDENCE_OPTIONS[0]
}

// ── Add / Edit dialog ────────────────────────────────────────────────────────

interface DialogState {
  yearId: string
  goal: YearlyGoal | null // null = new goal
}

function GoalDialog({
  state,
  onClose,
}: {
  state: DialogState
  onClose: () => void
}) {
  const { addYearlyGoal, updateYearlyGoal, deleteYearlyGoal, activeCompany } = useApp()
  const year = activeCompany.years.find((y) => y.id === state.yearId)!

  const isEdit = state.goal !== null
  const [objective, setObjective] = useState(state.goal?.objective ?? "")
  const [krTitles, setKrTitles] = useState<string[]>(
    state.goal?.keyResults.map((kr) => kr.title) ?? [""]
  )

  function setKr(idx: number, value: string) {
    setKrTitles((prev) => prev.map((t, i) => (i === idx ? value : t)))
  }

  function addKrRow() {
    setKrTitles((prev) => [...prev, ""])
  }

  function removeKrRow(idx: number) {
    setKrTitles((prev) => prev.filter((_, i) => i !== idx))
  }

  function handleSave() {
    const trimmed = objective.trim()
    if (!trimmed) return
    const filled = krTitles.map((t) => t.trim()).filter(Boolean)
    if (isEdit && state.goal) {
      const existingKRs = state.goal.keyResults
      updateYearlyGoal(
        state.yearId,
        state.goal.id,
        trimmed,
        filled.map((title, i) => ({
          title,
          confidence: existingKRs[i]?.confidence ?? "not_started",
        }))
      )
    } else {
      addYearlyGoal(state.yearId, trimmed, filled)
    }
    onClose()
  }

  function handleDelete() {
    if (isEdit && state.goal) {
      deleteYearlyGoal(state.yearId, state.goal.id)
      onClose()
    }
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            {isEdit ? "Edit goal" : `New goal — ${year.year}`}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Objective */}
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Objective
          </label>
          <Input
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="e.g. Reach product-market fit and scale revenue"
            className="bg-background"
            autoFocus
          />
        </div>

        {/* Key results */}
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Key results
          </label>
          <div className="flex flex-col gap-2">
            {krTitles.map((title, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-muted-foreground/40 text-xs w-4 text-right shrink-0">{idx + 1}.</span>
                <Input
                  value={title}
                  onChange={(e) => setKr(idx, e.target.value)}
                  placeholder={`Key result ${idx + 1}`}
                  className="bg-background"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); addKrRow() }
                  }}
                />
                {krTitles.length > 1 && (
                  <button
                    onClick={() => removeKrRow(idx)}
                    className="shrink-0 rounded p-1 text-muted-foreground/40 hover:text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={addKrRow}
            className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Add key result
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border pt-4">
          {isEdit ? (
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete goal
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!objective.trim()}>
              {isEdit ? "Save changes" : "Create goal"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function YearlyGoals({ years }: { years: Year[] }) {
  const { updateYearlyKRConfidence } = useApp()
  const [dialog, setDialog] = useState<DialogState | null>(null)

  return (
    <div className="mx-auto max-w-4xl">
      {dialog && (
        <GoalDialog state={dialog} onClose={() => setDialog(null)} />
      )}

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Yearly Goals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Long-term objectives and key results for the year
          </p>
        </div>
        {years.length > 0 && (
          <Button
            size="sm"
            className="gap-2"
            onClick={() => setDialog({ yearId: years[0].id, goal: null })}
          >
            <Plus className="h-4 w-4" />
            Add Goal
          </Button>
        )}
      </div>

      {years.map((year) => (
        <div key={year.id} className="mb-10">
          <div className="flex flex-col gap-4">
            {year.goals.map((goal) => (
              <div
                key={goal.id}
                className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/30"
              >
                {/* Goal header */}
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Target className="h-4 w-4 text-primary" />
                    </div>
                    <h3 className="text-base font-semibold text-foreground">
                      {goal.objective}
                    </h3>
                  </div>
                  <button
                    onClick={() => setDialog({ yearId: year.id, goal })}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground/40 opacity-0 transition-all hover:bg-secondary hover:text-muted-foreground group-hover:opacity-100"
                    title="Edit goal"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Key results */}
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
                                "flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium transition-colors hover:bg-secondary",
                                option.color
                              )}
                            >
                              <span className={cn("h-1.5 w-1.5 rounded-full", option.dot)} />
                              {option.label}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" sideOffset={4}>
                            {CONFIDENCE_OPTIONS.map((opt) => (
                              <DropdownMenuItem
                                key={opt.value}
                                onClick={() => updateYearlyKRConfidence(year.id, goal.id, kr.id, opt.value)}
                                className="gap-2"
                              >
                                <span className={cn("h-2 w-2 rounded-full", opt.dot)} />
                                <span className={cn("text-sm", opt.color)}>{opt.label}</span>
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
        </div>
      )}
    </div>
  )
}
