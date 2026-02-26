"use client"

import { useState, useRef, useCallback } from "react"
import { useApp } from "@/lib/store"
import type { Metric } from "@/lib/mock-data"
import { BarChart3, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ── Editable cell ──────────────────────────────────────────────────────────

function MetricCell({
  value,
  onChange,
}: {
  value: number | undefined
  onChange: (v: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const startEdit = useCallback(() => {
    setDraft(value != null && value !== 0 ? String(value) : "")
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [value])

  const commit = useCallback(() => {
    setEditing(false)
    const num = parseFloat(draft)
    if (!isNaN(num)) onChange(num)
  }, [draft, onChange])

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="h-7 w-full rounded border border-primary/40 bg-background px-1.5 text-right text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/30"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit()
          if (e.key === "Escape") setEditing(false)
        }}
      />
    )
  }

  return (
    <button
      onClick={startEdit}
      className={cn(
        "flex h-7 w-full items-center justify-end rounded px-1.5 text-xs transition-colors",
        value != null && value !== 0
          ? "text-foreground hover:bg-secondary"
          : "text-muted-foreground/30 hover:bg-secondary hover:text-muted-foreground"
      )}
    >
      {value != null && value !== 0 ? formatDisplay(value) : "\u2014"}
    </button>
  )
}

function formatDisplay(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 10_000) return `${(v / 1_000).toFixed(0)}K`
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`
  return v.toLocaleString()
}

// ── Month labels ────────────────────────────────────────────────────────────

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

// ── Add Metric Dialog ───────────────────────────────────────────────────────

function AddMetricDialog({
  categories,
  onAdd,
  onClose,
}: {
  categories: string[]
  onAdd: (metric: Omit<Metric, "id">) => void
  onClose: () => void
}) {
  const [name, setName] = useState("")
  const [category, setCategory] = useState(categories[0] ?? "Other")
  const [newCategory, setNewCategory] = useState("")
  const [useNew, setUseNew] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const finalCategory = useNew && newCategory.trim() ? newCategory.trim() : category
    onAdd({
      name: name.trim(),
      description: "",
      category: finalCategory,
      values: {},
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">Add Metric</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
            <input
              autoFocus
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/30"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Monthly Recurring Revenue"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Category
            </label>
            {!useNew ? (
              <div className="flex gap-2">
                <select
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/30"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <Button type="button" variant="outline" size="sm" onClick={() => setUseNew(true)}>
                  New
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  autoFocus
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/30"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="New category name"
                />
                <Button type="button" variant="outline" size="sm" onClick={() => setUseNew(false)}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!name.trim()}>
              Add Metric
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export function MonthlyMetrics() {
  const { activeCompany, updateMetricValue, addMetric, deleteMetric } = useApp()
  const metrics = activeCompany.metrics
  const [showAdd, setShowAdd] = useState(false)

  // Current month (1-based)
  const currentMonth = new Date().getMonth() + 1

  // Determine month range to show: from month 1 up to at least currentMonth, with space to fill ahead
  const monthEnd = Math.min(Math.max(currentMonth + 1, 3), 12)
  const months = Array.from({ length: monthEnd }, (_, i) => i + 1)

  // Group by category, preserving insertion order
  const categoryOrder: string[] = []
  const grouped: Record<string, Metric[]> = {}
  for (const m of metrics) {
    if (!grouped[m.category]) {
      grouped[m.category] = []
      categoryOrder.push(m.category)
    }
    grouped[m.category].push(m)
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Monthly Metrics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track the health and impact of strategy on company results
          </p>
        </div>
        <Button size="sm" className="gap-2 shrink-0 self-start sm:self-auto" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" />
          Add Metric
        </Button>
      </div>

      {metrics.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[600px] border-collapse">
            {/* Header row: metric name column + description + month columns */}
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground w-[220px]">
                  Metric
                </th>
                {months.map((m) => (
                  <th
                    key={m}
                    className={cn(
                      "px-2 py-2.5 text-center text-xs font-medium w-[72px]",
                      m === currentMonth
                        ? "text-primary font-semibold"
                        : "text-muted-foreground"
                    )}
                  >
                    {MONTH_LABELS[m - 1]}
                  </th>
                ))}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {categoryOrder.map((category) => (
                <CategoryGroup
                  key={category}
                  category={category}
                  metrics={grouped[category]}
                  months={months}
                  currentMonth={currentMonth}
                  updateMetricValue={updateMetricValue}
                  deleteMetric={deleteMetric}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
          <BarChart3 className="mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No metrics added yet</p>
          <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" />
            Add your first metric
          </Button>
        </div>
      )}

      {showAdd && (
        <AddMetricDialog
          categories={categoryOrder.length > 0 ? categoryOrder : ["Other"]}
          onAdd={addMetric}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  )
}

// ── Category group ──────────────────────────────────────────────────────────

function CategoryGroup({
  category,
  metrics,
  months,
  currentMonth,
  updateMetricValue,
  deleteMetric,
}: {
  category: string
  metrics: Metric[]
  months: number[]
  currentMonth: number
  updateMetricValue: (metricId: string, month: number, value: number) => void
  deleteMetric: (metricId: string) => void
}) {
  return (
    <>
      {/* Category header row */}
      <tr className="border-t border-border">
        <td
          colSpan={months.length + 2}
          className="px-4 pt-5 pb-2 text-sm font-bold text-foreground"
        >
          {category}
        </td>
      </tr>
      {/* Metric rows */}
      {metrics.map((metric) => (
        <MetricRow
          key={metric.id}
          metric={metric}
          months={months}
          currentMonth={currentMonth}
          updateMetricValue={updateMetricValue}
          deleteMetric={deleteMetric}
        />
      ))}
    </>
  )
}

// ── Metric row ──────────────────────────────────────────────────────────────

function MetricRow({
  metric,
  months,
  currentMonth,
  updateMetricValue,
  deleteMetric,
}: {
  metric: Metric
  months: number[]
  currentMonth: number
  updateMetricValue: (metricId: string, month: number, value: number) => void
  deleteMetric: (metricId: string) => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <tr
      className="group border-t border-border/40 transition-colors hover:bg-secondary/30"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <td className="px-4 py-1.5 text-sm text-foreground">
        {metric.name}
      </td>
      {months.map((m) => (
        <td
          key={m}
          className={cn(
            "px-1 py-1",
            m === currentMonth && "bg-primary/5"
          )}
        >
          <MetricCell
            value={metric.values[m]}
            onChange={(v) => updateMetricValue(metric.id, m, v)}
          />
        </td>
      ))}
      <td className="px-1 py-1.5">
        {hovered && (
          <button
            onClick={() => deleteMetric(metric.id)}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive"
            title="Delete metric"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </td>
    </tr>
  )
}
