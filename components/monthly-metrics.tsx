"use client"

import { useApp } from "@/lib/store"
import { formatMetricValue, metricCategoryLabels } from "@/lib/mock-data"
import type { Metric } from "@/lib/mock-data"
import { BarChart3, Plus, TrendingUp, TrendingDown, Minus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

function MetricCard({ metric }: { metric: Metric }) {
  const values = metric.values
  const latestValue = values.length > 0 ? values[values.length - 1].value : 0
  const previousValue = values.length > 1 ? values[values.length - 2].value : latestValue

  const changePercent =
    previousValue > 0
      ? Math.round(((latestValue - previousValue) / previousValue) * 100)
      : 0

  const isPositive = changePercent > 0
  const isNegative = changePercent < 0

  // Simple sparkline bars
  const maxVal = Math.max(...values.map((v) => v.value), 1)

  return (
    <div className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/20">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {metric.name}
          </p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {formatMetricValue(latestValue)}
          </p>
        </div>
        <div
          className={cn(
            "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
            isPositive && "bg-primary/10 text-primary",
            isNegative && "bg-destructive/10 text-destructive",
            !isPositive && !isNegative && "bg-secondary text-muted-foreground"
          )}
        >
          {isPositive && <TrendingUp className="h-3 w-3" />}
          {isNegative && <TrendingDown className="h-3 w-3" />}
          {!isPositive && !isNegative && <Minus className="h-3 w-3" />}
          {changePercent > 0 ? "+" : ""}
          {changePercent}%
        </div>
      </div>

      {/* Sparkline */}
      <div className="mt-4 flex items-end gap-1.5">
        {values.map((v, idx) => {
          const height = (v.value / maxVal) * 32
          return (
            <div key={idx} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={cn(
                  "w-full rounded-sm",
                  idx === values.length - 1
                    ? "bg-primary"
                    : "bg-primary/20"
                )}
                style={{ height: `${Math.max(height, 3)}px` }}
              />
              <span className="text-[10px] text-muted-foreground">
                {v.month.split(" ")[0].slice(0, 3)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function MonthlyMetrics() {
  const { activeCompany } = useApp()
  const metrics = activeCompany.metrics

  // Group by category
  const grouped: Record<string, Metric[]> = {}
  for (const metric of metrics) {
    if (!grouped[metric.category]) grouped[metric.category] = []
    grouped[metric.category].push(metric)
  }

  const categories = Object.keys(grouped)

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Monthly Metrics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track the health and impact of strategy on company results
          </p>
        </div>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Metric
        </Button>
      </div>

      {categories.map((category) => (
        <div key={category} className="mb-8">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {metricCategoryLabels[category] ?? category}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {grouped[category].map((metric) => (
              <MetricCard key={metric.id} metric={metric} />
            ))}
          </div>
        </div>
      ))}

      {metrics.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
          <BarChart3 className="mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No metrics added yet</p>
          <Button variant="outline" size="sm" className="mt-4 gap-2">
            <Plus className="h-4 w-4" />
            Add your first metric
          </Button>
        </div>
      )}
    </div>
  )
}
