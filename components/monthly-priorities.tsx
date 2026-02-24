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
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Filter, X } from "lucide-react"

export function MonthlyPriorities() {
  const { activeCompany } = useApp()
  const priorities = getMonthlyPriorities(activeCompany)

  // Get unique founders from all priorities
  const allFounders = Array.from(
    new Set(priorities.map((p) => p.keyResult.owner).filter(Boolean))
  ).sort()

  // Filter state
  const [selectedFounders, setSelectedFounders] = useState<Set<string>>(
    new Set(allFounders)
  )

  // Toggle founder in filter
  function toggleFounder(founder: string) {
    const next = new Set(selectedFounders)
    if (next.has(founder)) {
      next.delete(founder)
    } else {
      next.add(founder)
    }
    setSelectedFounders(next)
  }

  // Clear all filters
  function clearFilters() {
    setSelectedFounders(new Set(allFounders))
  }

  // Group by owner (filtered)
  const byOwner: Record<string, typeof priorities> = {}
  for (const p of priorities) {
    const owner = p.keyResult.owner!
    if (selectedFounders.has(owner)) {
      if (!byOwner[owner]) byOwner[owner] = []
      byOwner[owner].push(p)
    }
  }

  const filteredCount = Object.values(byOwner).reduce(
    (sum, items) => sum + items.length,
    0
  )

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Priorities</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Key results that founders are actively working on and reporting weekly
          </p>
        </div>

        {/* Founder filter dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              title={`Filtering ${selectedFounders.size} of ${allFounders.length} founders`}
            >
              <Filter className="h-4 w-4" />
              Founders
              {selectedFounders.size < allFounders.length && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                  {allFounders.length - selectedFounders.size}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Show priorities for
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {allFounders.map((founder) => {
              const initials = founder.split(" ").map((n) => n[0]).join("")
              return (
                <DropdownMenuCheckboxItem
                  key={founder}
                  checked={selectedFounders.has(founder)}
                  onCheckedChange={() => toggleFounder(founder)}
                  className="gap-2"
                >
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="bg-secondary text-[9px] text-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{founder}</span>
                </DropdownMenuCheckboxItem>
              )
            })}
            {selectedFounders.size < allFounders.length && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={false}
                  onCheckedChange={clearFilters}
                  className="gap-2 text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                  Show all
                </DropdownMenuCheckboxItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-3">
          <Badge className="border-chart-3/20 bg-chart-3/10 text-chart-3">
            {filteredCount} active
          </Badge>
        </div>
      </div>

      {Object.entries(byOwner).length > 0 ? (
        Object.entries(byOwner).map(([owner, items]) => {
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
      })
    ) : (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
        <Filter className="mb-3 h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No priorities match the selected founders</p>
        <button
          onClick={clearFilters}
          className="mt-3 text-xs text-primary hover:underline"
        >
          Clear filters to see all priorities
        </button>
      </div>
    )}

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
