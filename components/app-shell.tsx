"use client"

import { useState } from "react"
import { useApp } from "@/lib/store"
import { Sidebar, type NavSection } from "./sidebar"
import { YearlyGoals } from "./yearly-goals"
import { QuarterlyGoals } from "./quarterly-goals"
import { MonthlyPriorities } from "./monthly-priorities"
import { MonthlyMetrics } from "./monthly-metrics"
import { ArchiveView } from "./archive-view"
import { getActiveYears, getActiveQuarters } from "@/lib/mock-data"
import { ChevronLeft, ChevronRight } from "lucide-react"

export function AppShell() {
  const { activeCompany } = useApp()
  const [activeSection, setActiveSection] = useState<NavSection>("quarterly")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const activeYears = getActiveYears(activeCompany)
  const activeQuarters = getActiveQuarters(activeCompany)

  const sectionTitles: Record<NavSection, string> = {
    yearly: "Yearly Goals",
    quarterly: "Quarterly Goals",
    priorities: "Priorities",
    metrics: "Monthly Metrics",
    archive: "Archive",
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        collapsed={sidebarCollapsed}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar - slim header with collapse toggle and section title */}
        <header className="flex h-12 items-center border-b border-border bg-background px-4">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="mr-3 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
          <h1 className="text-sm font-medium text-foreground">
            {sectionTitles[activeSection]}
          </h1>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {activeSection === "yearly" && (
            <YearlyGoals years={activeYears} />
          )}
          {activeSection === "quarterly" && (
            <QuarterlyGoals
              quarters={activeQuarters}
              years={activeYears}
            />
          )}
          {activeSection === "priorities" && <MonthlyPriorities />}
          {activeSection === "metrics" && <MonthlyMetrics />}
          {activeSection === "archive" && <ArchiveView />}
        </main>
      </div>
    </div>
  )
}
