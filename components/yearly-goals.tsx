"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import type { Year, YearlyGoal, Confidence } from "@/lib/mock-data"
import { useApp } from "@/lib/store"
import { Target, Plus, Circle, CheckCircle2, Pencil, Trash2, X } from "lucide-react"
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
  { value: "not_started",          label: "Not started",          color: "text-muted-foreground",   dot: "bg-muted-foreground/40" },
  { value: "confident",            label: "Confident",            color: "text-emerald-400",         dot: "bg-emerald-400" },
  { value: "moderately_confident", label: "Moderately confident", color: "text-amber-400",           dot: "bg-amber-400" },
  { value: "not_confident",        label: "Not confident",        color: "text-red-400",             dot: "bg-red-400" },
  { value: "done",                 label: "Done",                 color: "text-sky-400",             dot: "bg-sky-400" },
  { value: "discontinued",         label: "Discontinued",         color: "text-muted-foreground/60", dot: "bg-muted-foreground/30" },
]

function getOption(confidence: Confidence) {
  return CONFIDENCE_OPTIONS.find((o) => o.value === confidence) ?? CONFIDENCE_OPTIONS[0]
}

// ── Confetti burst ───────────────────────────────────────────────────────────

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  rotation: number
  rotationSpeed: number
  size: number
  life: number
}

const COLORS = ["#38bdf8", "#34d399", "#fbbf24", "#f472b6", "#a78bfa", "#fb923c"]

function ConfettiBurst({ origin }: { origin: { x: number; y: number } }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particles = useRef<Particle[]>([])
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    // Spawn 80 particles from origin
    particles.current = Array.from({ length: 80 }, () => {
      const angle = Math.random() * Math.PI * 2
      const speed = 4 + Math.random() * 8
      return {
        x: origin.x,
        y: origin.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
        size: 5 + Math.random() * 6,
        life: 1,
      }
    })

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      let alive = false
      for (const p of particles.current) {
        if (p.life <= 0) continue
        alive = true
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.25 // gravity
        p.vx *= 0.98
        p.rotation += p.rotationSpeed
        p.life -= 0.018

        ctx.save()
        ctx.globalAlpha = Math.max(0, p.life)
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rotation * Math.PI) / 180)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        ctx.restore()
      }
      if (alive) {
        rafRef.current = requestAnimationFrame(draw)
      }
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [origin.x, origin.y])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[100]"
    />
  )
}

// ── Add / Edit dialog ────────────────────────────────────────────────────────

interface DialogState {
  yearId: string
  goal: YearlyGoal | null
}

function GoalDialog({ state, onClose }: { state: DialogState; onClose: () => void }) {
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
  function addKrRow() { setKrTitles((prev) => [...prev, ""]) }
  function removeKrRow(idx: number) { setKrTitles((prev) => prev.filter((_, i) => i !== idx)) }

  function handleSave() {
    const trimmed = objective.trim()
    if (!trimmed) return
    const filled = krTitles.map((t) => t.trim()).filter(Boolean)
    if (isEdit && state.goal) {
      const existingKRs = state.goal.keyResults
      updateYearlyGoal(state.yearId, state.goal.id, trimmed,
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            {isEdit ? "Edit goal" : `New goal — ${year.year}`}
          </h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Objective</label>
          <Input value={objective} onChange={(e) => setObjective(e.target.value)}
            placeholder="e.g. Reach product-market fit and scale revenue"
            className="bg-background" autoFocus />
        </div>

        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Key results</label>
          <div className="flex flex-col gap-2">
            {krTitles.map((title, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-4 shrink-0 text-right text-xs text-muted-foreground/40">{idx + 1}.</span>
                <Input value={title} onChange={(e) => setKr(idx, e.target.value)}
                  placeholder={`Key result ${idx + 1}`} className="bg-background"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKrRow() } }} />
                {krTitles.length > 1 && (
                  <button onClick={() => removeKrRow(idx)} className="shrink-0 rounded p-1 text-muted-foreground/40 hover:text-muted-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button onClick={addKrRow} className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <Plus className="h-3.5 w-3.5" />
            Add key result
          </button>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-4">
          {isEdit ? (
            <button onClick={handleDelete} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
              Delete goal
            </button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
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
  const [confettiOrigin, setConfettiOrigin] = useState<{ x: number; y: number } | null>(null)

  const handleConfidenceChange = useCallback(
    (
      yearId: string,
      goalId: string,
      krId: string,
      newConfidence: Confidence,
      triggerEl: HTMLElement | null
    ) => {
      updateYearlyKRConfidence(yearId, goalId, krId, newConfidence)
      if (newConfidence === "done" && triggerEl) {
        const rect = triggerEl.getBoundingClientRect()
        setConfettiOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
        setTimeout(() => setConfettiOrigin(null), 2200)
      }
    },
    [updateYearlyKRConfidence]
  )

  return (
    <div className="mx-auto max-w-4xl">
      {confettiOrigin && <ConfettiBurst origin={confettiOrigin} />}
      {dialog && <GoalDialog state={dialog} onClose={() => setDialog(null)} />}

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Yearly Goals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Long-term objectives and key results for the year
          </p>
        </div>
        {years.length > 0 && (
          <Button size="sm" className="gap-2 shrink-0 self-start sm:self-auto" onClick={() => setDialog({ yearId: years[0].id, goal: null })}>
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
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Target className="h-4 w-4 text-primary" />
                    </div>
                    <h3 className="text-base font-semibold text-foreground">{goal.objective}</h3>
                  </div>
                  <button
                    onClick={() => setDialog({ yearId: year.id, goal })}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground/40 md:opacity-0 transition-all hover:bg-secondary hover:text-muted-foreground md:group-hover:opacity-100"
                    title="Edit goal"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="ml-0 sm:ml-11 flex flex-col gap-1.5">
                  {goal.keyResults.map((kr) => {
                    const option = getOption(kr.confidence)
                    const isDone = kr.confidence === "done"
                    const isDiscontinued = kr.confidence === "discontinued"
                    return (
                      <div
                        key={kr.id}
                        className={cn(
                          "flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 rounded-lg px-2 py-2 sm:py-1.5 transition-colors hover:bg-secondary/50",
                          isDone && "bg-sky-500/5"
                        )}
                      >
                        <div className="flex items-center gap-2.5 text-sm">
                          {isDone ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                          ) : (
                            <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30" />
                          )}
                          <span
                            className={cn(
                              "text-foreground/80",
                              isDone && "font-medium text-sky-300",
                              isDiscontinued && "line-through text-muted-foreground/50"
                            )}
                          >
                            {kr.title}
                          </span>
                          {isDone && (
                            <span className="rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-400">
                              Done
                            </span>
                          )}
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
                                onClick={(e) =>
                                  handleConfidenceChange(
                                    year.id,
                                    goal.id,
                                    kr.id,
                                    opt.value,
                                    (e.target as HTMLElement).closest("[role=menuitem]") as HTMLElement
                                  )
                                }
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
