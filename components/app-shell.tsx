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
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

type GoalTab = "yearly" | "quarterly" | "priorities"

export function AppShell() {
  const { activeCompany } = useApp()
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
