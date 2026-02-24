"use client"

import { useState, useMemo } from "react"
import { useApp } from "@/lib/store"
import { Sidebar, type MainSection } from "./sidebar"
import { YearlyGoals } from "./yearly-goals"
import { QuarterlyGoals } from "./quarterly-goals"
import { MonthlyPriorities } from "./monthly-priorities"
import { MonthlyMetrics } from "./monthly-metrics"
import { ArchiveView } from "./archive-view"
import { getActiveYears, getActiveQuarters } from "@/lib/mock-data"
import { ChevronLeft, ChevronRight, Plus, Calendar, Target } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

type GoalTab = "yearly" | "quarterly" | "priorities"

export function AppShell() {
  const { activeCompany, addYear, addQuarter } = useApp()
  const [activeSection, setActiveSection] = useState<MainSection>("goals")
  const [activeGoalTab, setActiveGoalTab] = useState<GoalTab>("quarterly")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const activeYears = getActiveYears(activeCompany)
  const activeQuarters = getActiveQuarters(activeCompany)

  const goalTabs = useMemo(() => {
    const yearLabel = activeYears.length > 0 ? String(activeYears[0].year) : "Year"
    const qLabel =
      activeQuarters.length > 0
        ? `${activeQuarters[0].label.split(" ")[0]} '${String(activeQuarters[0].year).slice(-2)}`
        : "Quarter"

    return [
      { id: "yearly" as GoalTab, label: yearLabel },
      { id: "quarterly" as GoalTab, label: qLabel },
      { id: "priorities" as GoalTab, label: "Priorities" },
    ]
  }, [activeYears, activeQuarters])

  function handleAddYear() {
    const now = new Date()
    const nextYear = now.getFullYear() + 1
    // Check if this year already exists
    const exists = activeCompany.years.some((y) => y.year === nextYear && y.isActive)
    const year = exists ? nextYear + 1 : nextYear
    addYear(year)
    setActiveGoalTab("yearly")
  }

  function handleAddQuarter() {
    const now = new Date()
    const currentQ = Math.ceil((now.getMonth() + 1) / 3)
    const year = now.getFullYear()

    // Find the next quarter that doesn't exist yet
    let q = currentQ
    let y = year
    for (let i = 0; i < 8; i++) {
      const label = `Q${q} ${y}`
      const exists = activeCompany.quarters.some(
        (qtr) => qtr.label === label && qtr.isActive
      )
      if (!exists) {
        addQuarter(label, y)
        setActiveGoalTab("quarterly")
        return
      }
      q++
      if (q > 4) {
        q = 1
        y++
      }
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        collapsed={sidebarCollapsed}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-12 items-center border-b border-border bg-background px-4">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="mr-4 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>

          {/* Goal tabs - only visible when Goals section is active */}
          {activeSection === "goals" && (
            <div className="flex h-full items-stretch gap-1">
              <nav className="flex h-full items-stretch gap-1" role="tablist">
                {goalTabs.map((tab) => {
                  const isActive = activeGoalTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveGoalTab(tab.id)}
                      className={cn(
                        "relative flex items-center px-3 text-sm transition-colors",
                        isActive
                          ? "font-medium text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {tab.label}
                      {isActive && (
                        <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />
                      )}
                    </button>
                  )
                })}
              </nav>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="ml-1 flex h-7 w-7 items-center justify-center self-center rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                    aria-label="Add new goal tab"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" sideOffset={8}>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Add new tab
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleAddYear}>
                    <Calendar className="h-4 w-4" />
                    Yearly Goals
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleAddQuarter}>
                    <Target className="h-4 w-4" />
                    Quarterly Goals
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* Section title for non-Goals sections */}
          {activeSection !== "goals" && (
            <h1 className="text-sm font-medium text-foreground">
              {activeSection === "metrics"
                ? "Monthly Metrics"
                : activeSection === "archive"
                  ? "Archive"
                  : ""}
            </h1>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {activeSection === "goals" && activeGoalTab === "yearly" && (
            <YearlyGoals years={activeYears} />
          )}
          {activeSection === "goals" && activeGoalTab === "quarterly" && (
            <QuarterlyGoals
              quarters={activeQuarters}
              years={activeYears}
            />
          )}
          {activeSection === "goals" && activeGoalTab === "priorities" && (
            <MonthlyPriorities />
          )}
          {activeSection === "metrics" && <MonthlyMetrics />}
          {activeSection === "archive" && <ArchiveView />}
        </main>
      </div>
    </div>
  )
}
