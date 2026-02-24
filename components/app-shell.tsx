"use client"

import { useState } from "react"
import { useApp } from "@/lib/store"
import { Sidebar } from "./sidebar"
import { YearlyGoals } from "./yearly-goals"
import { QuarterlyGoals } from "./quarterly-goals"
import { MonthlyPriorities } from "./monthly-priorities"
import { MonthlyMetrics } from "./monthly-metrics"
import { ArchiveView } from "./archive-view"
import { getActiveYears, getActiveQuarters } from "@/lib/mock-data"
import {
  Target,
  TrendingUp,
  Flame,
  BarChart3,
  Archive,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type NavSection =
  | "yearly"
  | "quarterly"
  | "priorities"
  | "metrics"
  | "archive"

const navItems: { id: NavSection; label: string; icon: typeof Target }[] = [
  { id: "yearly", label: "Yearly Goals", icon: Target },
  { id: "quarterly", label: "Quarterly Goals", icon: TrendingUp },
  { id: "priorities", label: "Monthly Priorities", icon: Flame },
  { id: "metrics", label: "Monthly Metrics", icon: BarChart3 },
  { id: "archive", label: "Archive", icon: Archive },
]

export function AppShell() {
  const { activeCompany } = useApp()
  const [activeSection, setActiveSection] = useState<NavSection>("quarterly")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const activeYears = getActiveYears(activeCompany)
  const activeQuarters = getActiveQuarters(activeCompany)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar collapsed={sidebarCollapsed} />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 items-center border-b border-border bg-background px-4">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="mr-4 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeSection === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden md:inline">{item.label}</span>
                </button>
              )
            })}
          </nav>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {activeSection === "yearly" && (
            <YearlyGoals years={activeYears} />
          )}
          {activeSection === "quarterly" && (
            <QuarterlyGoals quarters={activeQuarters} />
          )}
          {activeSection === "priorities" && <MonthlyPriorities />}
          {activeSection === "metrics" && <MonthlyMetrics />}
          {activeSection === "archive" && <ArchiveView />}
        </main>
      </div>
    </div>
  )
}
