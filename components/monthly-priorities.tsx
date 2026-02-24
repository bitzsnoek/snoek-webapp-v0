"use client"

import { useApp } from "@/lib/store"
import { getMonthlyPriorities } from "@/lib/mock-data"
import { KeyResultCard } from "@/components/key-result-card"
import { Flame } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export function MonthlyPriorities() {
  const { activeCompany } = useApp()
  const priorities = getMonthlyPriorities(activeCompany)

  // Group by owner (owner is guaranteed non-null here by getMonthlyPriorities)
  const byOwner: Record<string, typeof priorities> = {}
  for (const p of priorities) {
    const owner = p.keyResult.owner!
    if (!byOwner[owner]) byOwner[owner] = []
    byOwner[owner].push(p)
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">Priorities</h1>
          <Badge className="border-chart-3/20 bg-chart-3/10 text-chart-3">
            {priorities.length} active
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Key results that founders are actively working on and reporting weekly
        </p>
      </div>

      {Object.entries(byOwner).map(([owner, items]) => {
        const initials = owner.split(" ").map((n) => n[0]).join("")

        return (
          <div key={owner} className="mb-8">
            <div className="mb-3 flex items-center gap-2.5">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-secondary text-xs text-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-sm font-semibold text-foreground">{owner}</h2>
              <span className="text-xs text-muted-foreground">
                {items.length} {items.length === 1 ? "priority" : "priorities"}
              </span>
            </div>

            <div className="flex flex-col gap-4">
              {items.map(({ quarter, goal, keyResult: kr }) => (
                <div key={kr.id}>
                  {/* Objective context label */}
                  <p className="mb-1.5 ml-1 text-xs text-muted-foreground/60">
                    {goal.objective}
                  </p>
                  <KeyResultCard
                    kr={kr}
                    quarterId={quarter.id}
                    goalId={goal.id}
                  />
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {priorities.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
          <Flame className="mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No priorities set yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Mark key results as monthly priorities in the quarterly goals view
          </p>
        </div>
      )}
    </div>
  )
}
