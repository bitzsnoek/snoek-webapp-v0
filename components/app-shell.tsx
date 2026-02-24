"use client"

import { useState, useMemo } from "react"
import { useApp } from "@/lib/store"
import { Sidebar, type MainSection } from "./sidebar"
import { YearlyGoals } from "./yearly-goals"
import { QuarterlyGoals } from "./quarterly-goals"
import { MonthlyPriorities } from "./monthly-priorities"
import { MonthlyMetrics } from "./monthly-metrics"
import { ArchiveView } from "./archive-view"
import { CompanySettings } from "./company-settings"
import { getActiveYears, getActiveQuarters } from "@/lib/mock-data"
import { Plus, Archive } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

type GoalTabId = `year-${string}` | `quarter-${string}` | "priorities"

type AddDialogType = "year" | "quarter" | null

export function AppShell() {
  const { activeCompany, addYear, addQuarter, archiveTab } = useApp()
  const [activeSection, setActiveSection] = useState<MainSection>("goals")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Active tab id: "year-{yearId}", "quarter-{quarterId}", or "priorities"
  const [activeTabId, setActiveTabId] = useState<GoalTabId>("quarter-q1-2025")

  // "Add tab" dialog state
  const [addDialog, setAddDialog] = useState<AddDialogType>(null)
  const [addValue, setAddValue] = useState("")
  const [addError, setAddError] = useState("")

  const activeYears = getActiveYears(activeCompany)
  const activeQuarters = getActiveQuarters(activeCompany)

  // Sort years descending, quarters descending by year then quarter number
  const sortedYears = useMemo(
    () => [...activeYears].sort((a, b) => b.year - a.year),
    [activeYears]
  )
  const sortedQuarters = useMemo(
    () =>
      [...activeQuarters].sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year
        const qa = parseInt(a.label.replace(/Q(\d).*/, "$1"))
        const qb = parseInt(b.label.replace(/Q(\d).*/, "$1"))
        return qb - qa
      }),
    [activeQuarters]
  )

  // Derive active content from tab id
  const activeYearId = activeTabId.startsWith("year-")
    ? activeTabId.replace("year-", "")
    : null
  const activeQuarterId = activeTabId.startsWith("quarter-")
    ? activeTabId.replace("quarter-", "")
    : null

  const activeYear = sortedYears.find((y) => y.id === activeYearId) ?? null
  const activeQuarter = sortedQuarters.find((q) => q.id === activeQuarterId) ?? null

  function formatYearLabel(year: number) {
    return String(year)
  }

  function formatQuarterLabel(label: string, year: number) {
    const q = label.split(" ")[0] // "Q1"
    return `${q} '${String(year).slice(-2)}`
  }

  function handleArchive(type: "year" | "quarter", id: string) {
    archiveTab(type, id)
    // Switch to a still-active tab
    if (type === "year") {
      const remaining = sortedYears.filter((y) => y.id !== id)
      if (remaining.length > 0) setActiveTabId(`year-${remaining[0].id}`)
      else if (sortedQuarters.length > 0)
        setActiveTabId(`quarter-${sortedQuarters[0].id}`)
      else setActiveTabId("priorities")
    } else {
      const remaining = sortedQuarters.filter((q) => q.id !== id)
      if (remaining.length > 0) setActiveTabId(`quarter-${remaining[0].id}`)
      else if (sortedYears.length > 0) setActiveTabId(`year-${sortedYears[0].id}`)
      else setActiveTabId("priorities")
    }
  }

  function openAddDialog(type: "year" | "quarter") {
    setAddDialog(type)
    setAddValue("")
    setAddError("")
  }

  function handleAddConfirm() {
    if (addDialog === "year") {
      const yr = parseInt(addValue.trim())
      if (isNaN(yr) || yr < 2000 || yr > 2100) {
        setAddError("Enter a valid year (e.g. 2026)")
        return
      }
      const exists = [...activeYears, ...activeCompany.years.filter(y => !y.isActive)].some(
        (y) => y.year === yr
      )
      if (exists) {
        setAddError("A tab for this year already exists")
        return
      }
      addYear(yr)
      // Switch to the new tab — we don't know the id yet, so we'll pick it after re-render
      // by relying on activeYears updating; use a flag approach
      setAddDialog(null)
      // The new year will be first in sortedYears after state updates
      setTimeout(() => {
        const company = activeCompany
        const newYear = company.years.find((y) => y.year === yr)
        if (newYear) setActiveTabId(`year-${newYear.id}`)
      }, 50)
    } else {
      // Quarter: expect "Q1 2026" or "Q1"
      const raw = addValue.trim().toUpperCase()
      const match = raw.match(/^Q([1-4])\s*(\d{4})?$/)
      if (!match) {
        setAddError('Enter a quarter like "Q2" or "Q2 2026"')
        return
      }
      const qNum = parseInt(match[1])
      const year = match[2] ? parseInt(match[2]) : new Date().getFullYear()
      const label = `Q${qNum} ${year}`
      const exists = [...activeQuarters, ...activeCompany.quarters.filter(q => !q.isActive)].some(
        (q) => q.label === label
      )
      if (exists) {
        setAddError(`A tab for ${label} already exists`)
        return
      }
      addQuarter(label, year)
      setAddDialog(null)
      setTimeout(() => {
        const company = activeCompany
        const newQ = company.quarters.find((q) => q.label === label)
        if (newQ) setActiveTabId(`quarter-${newQ.id}`)
      }, 50)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        collapsed={sidebarCollapsed}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onCollapse={setSidebarCollapsed}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-12 shrink-0 items-center border-b border-border bg-background px-4">
          {/* Goals tab bar */}
          {activeSection === "goals" && (
            <div className="flex h-full min-w-0 flex-1 items-stretch gap-0.5">
              {/* Year tabs */}
              {sortedYears.map((year) => {
                const tabId: GoalTabId = `year-${year.id}`
                const isActive = activeTabId === tabId
                return (
                  <GoalTab
                    key={year.id}
                    label={formatYearLabel(year.year)}
                    isActive={isActive}
                    onClick={() => setActiveTabId(tabId)}
                    onArchive={() => handleArchive("year", year.id)}
                  />
                )
              })}

              {/* Quarter tabs */}
              {sortedQuarters.map((quarter) => {
                const tabId: GoalTabId = `quarter-${quarter.id}`
                const isActive = activeTabId === tabId
                return (
                  <GoalTab
                    key={quarter.id}
                    label={formatQuarterLabel(quarter.label, quarter.year)}
                    isActive={isActive}
                    onClick={() => setActiveTabId(tabId)}
                    onArchive={() => handleArchive("quarter", quarter.id)}
                  />
                )
              })}

              {/* Priorities tab — always present, no archive button */}
              <GoalTab
                label="Priorities"
                isActive={activeTabId === "priorities"}
                onClick={() => setActiveTabId("priorities")}
              />

              {/* Add tab button */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center self-center rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                    aria-label="Add new tab"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" sideOffset={8}>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Add new tab
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => openAddDialog("year")}>
                    Yearly Goals
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openAddDialog("quarter")}>
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
                : activeSection === "settings"
                ? "Settings"
                : "Archive"}
            </h1>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {activeSection === "goals" && activeTabId === "priorities" && (
            <MonthlyPriorities />
          )}
          {activeSection === "goals" && activeYear && (
            <YearlyGoals years={[activeYear]} />
          )}
          {activeSection === "goals" && activeQuarter && (
            <QuarterlyGoals quarters={[activeQuarter]} years={activeYears} />
          )}
          {activeSection === "metrics" && <MonthlyMetrics />}
          {activeSection === "archive" && <ArchiveView />}
          {activeSection === "settings" && <CompanySettings />}
        </main>
      </div>

      {/* Add Tab Dialog */}
      <Dialog open={addDialog !== null} onOpenChange={(open) => !open && setAddDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {addDialog === "year" ? "Add Yearly Goals Tab" : "Add Quarterly Goals Tab"}
            </DialogTitle>
            <DialogDescription>
              {addDialog === "year"
                ? "Enter the year for the new tab (e.g. 2026)."
                : 'Enter the quarter and year (e.g. "Q2" or "Q2 2026").'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <Label htmlFor="add-tab-value">
              {addDialog === "year" ? "Year" : "Quarter"}
            </Label>
            <Input
              id="add-tab-value"
              placeholder={addDialog === "year" ? "2026" : "Q2 2026"}
              value={addValue}
              onChange={(e) => {
                setAddValue(e.target.value)
                setAddError("")
              }}
              onKeyDown={(e) => e.key === "Enter" && handleAddConfirm()}
              autoFocus
            />
            {addError && (
              <p className="text-xs text-destructive">{addError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialog(null)}>
              Cancel
            </Button>
            <Button onClick={handleAddConfirm}>Add tab</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---- GoalTab sub-component ----

function GoalTab({
  label,
  isActive,
  onClick,
  onArchive,
}: {
  label: string
  isActive: boolean
  onClick: () => void
  onArchive?: () => void
}) {
  return (
    <div className="group relative flex h-full items-stretch">
      <button
        role="tab"
        aria-selected={isActive}
        onClick={onClick}
        className={cn(
          "relative flex items-center gap-1 px-3 text-sm transition-colors",
          isActive
            ? "font-medium text-primary"
            : "text-muted-foreground hover:text-foreground",
          onArchive && "pr-2"
        )}
      >
        {label}
        {isActive && (
          <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />
        )}
      </button>

      {/* Archive button — only shown on hover, only when archiveable */}
      {onArchive && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onArchive()
          }}
          title="Archive this tab"
          className={cn(
            "flex items-center self-center rounded-sm p-0.5 text-muted-foreground/40 opacity-0 transition-all hover:text-muted-foreground group-hover:opacity-100",
            isActive && "text-muted-foreground/60"
          )}
          aria-label="Archive tab"
        >
          <Archive className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
