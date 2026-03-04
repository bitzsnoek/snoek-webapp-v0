"use client"

import { useState } from "react"
import { useApp } from "@/lib/store"
import { getMonthlyPriorities } from "@/lib/mock-data"
import { KeyResultCard } from "@/components/key-result-card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Filter, Flame, X } from "lucide-react"

export function MonthlyPriorities() {
  const { activeCompany, currentUser } = useApp()
  const priorities = getMonthlyPriorities(activeCompany)

  // Get unique owners from all priorities
  const allOwners = Array.from(
    new Set(priorities.map((p) => p.keyResult.owner).filter(Boolean))
  ).sort()

  // Auto-filter for founders: default to showing only their own priorities
  const isFounder = currentUser.role === "founder"
  const defaultFilter = isFounder ? currentUser.name : null
  const [selectedFounder, setSelectedFounder] = useState<string | null>(defaultFilter)

  // Optionally filter by selected founder
  const filteredPriorities = selectedFounder
    ? priorities.filter((p) => p.keyResult.owner === selectedFounder)
    : priorities

  // Group by owner
  const byOwner: Record<string, typeof filteredPriorities> = {}
  for (const p of filteredPriorities) {
    const owner = p.keyResult.owner!
    if (!byOwner[owner]) byOwner[owner] = []
    byOwner[owner].push(p)
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Priorities</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Key results being actively worked on and reported weekly
          </p>
        </div>

        {/* Founder filter dropdown with clear button */}
        <div className="flex items-center gap-2 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Filter className="h-4 w-4" />
                {selectedFounder ? (
                  <>
                    {selectedFounder}
                  </>
                ) : (
                  "All members"
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Filter by owner
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {selectedFounder && (
                <>
                  <DropdownMenuItem
                    onClick={() => setSelectedFounder(null)}
                    className="gap-2"
                  >
                    <X className="h-4 w-4" />
                    Show all
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {allOwners.map((owner) => {
                const memberObj = activeCompany.members?.find((m) => m.name === owner)
                const isSelected = selectedFounder === owner
                return (
                  <DropdownMenuItem
                    key={owner}
                    onClick={() => setSelectedFounder(owner)}
                    className="gap-2"
                  >
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="bg-secondary text-[9px] text-foreground">
                        {owner.split(" ").map((n) => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm">{owner}</span>
                      {memberObj && (
                        <span className="text-xs text-muted-foreground capitalize">{memberObj.roleTitle || memberObj.role}</span>
                      )}
                    </div>
                    {isSelected && (
                      <span className="ml-auto text-xs text-primary font-medium">✓</span>
                    )}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {selectedFounder && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedFounder(null)}
              className="h-8 w-8 p-0"
              title="Clear filter"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="mb-8">
        <Badge className="border-chart-3/20 bg-chart-3/10 text-chart-3">
          {filteredPriorities.length} active
        </Badge>
      </div>

      {Object.entries(byOwner).length > 0 ? (
        Object.entries(byOwner).map(([owner, items]) => {
          const memberObj = activeCompany.members?.find((m) => m.name === owner)
          const initials = owner.split(" ").map((n) => n[0]).join("")

          return (
            <div
              key={owner}
              className="mb-8 rounded-lg border border-border/60 bg-card/40 p-5"
            >
              {/* Founder header with clear visual hierarchy */}
              <div className="mb-6 flex items-center justify-between border-b border-border/40 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Avatar className="h-8 w-8">
<AvatarFallback className="bg-primary/20 text-xs font-semibold text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-foreground">{owner}</h2>
                    <p className="text-xs text-muted-foreground">
                      {memberObj?.roleTitle || memberObj?.role}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {items.length} {items.length === 1 ? "priority" : "priorities"}
                </Badge>
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
        })
      ) : selectedFounder ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
          <Filter className="mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No priorities for {selectedFounder}</p>
          <button
            onClick={() => setSelectedFounder(null)}
            className="mt-3 text-xs text-primary hover:underline"
          >
            Clear filter to see all priorities
          </button>
        </div>
      ) : (
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
