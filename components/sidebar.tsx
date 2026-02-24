"use client"

import { useApp } from "@/lib/store"
import { getActiveYears, getActiveQuarters } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import {
  Building2,
  ChevronDown,
  Compass,
  Target,
  TrendingUp,
  Flame,
  BarChart3,
  Archive,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export type NavSection =
  | "yearly"
  | "quarterly"
  | "priorities"
  | "metrics"
  | "archive"

function getQuarterLabel(quarters: ReturnType<typeof getActiveQuarters>): string {
  if (quarters.length === 0) return ""
  const q = quarters[0]
  const qNum = q.label.split(" ")[0] // "Q1"
  const yearShort = String(q.year).slice(-2) // "25"
  return `${qNum} '${yearShort}`
}

function getYearLabel(years: ReturnType<typeof getActiveYears>): string {
  if (years.length === 0) return ""
  return String(years[0].year)
}

function getCurrentMonthShort(): string {
  return new Date().toLocaleString("en-US", { month: "short" })
}

interface SidebarProps {
  collapsed: boolean
  activeSection: NavSection
  onSectionChange: (section: NavSection) => void
}

export function Sidebar({ collapsed, activeSection, onSectionChange }: SidebarProps) {
  const { coach, companies, activeCompany, setActiveCompanyId } = useApp()

  const activeYears = getActiveYears(activeCompany)
  const activeQuarters = getActiveQuarters(activeCompany)

  const yearLabel = getYearLabel(activeYears)
  const quarterLabel = getQuarterLabel(activeQuarters)
  const monthLabel = getCurrentMonthShort()

  const goalItems: { id: NavSection; label: string; tag: string; icon: typeof Target }[] = [
    { id: "yearly", label: "Yearly Goals", tag: yearLabel, icon: Target },
    { id: "quarterly", label: "Quarterly Goals", tag: quarterLabel, icon: TrendingUp },
    { id: "priorities", label: "Priorities", tag: monthLabel, icon: Flame },
  ]

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border bg-card transition-all duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-border px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
            <Compass className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold text-foreground">
              GoalTracker
            </span>
          )}
        </div>
      </div>

      {/* Company switcher */}
      <div className="border-b border-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-secondary",
                collapsed && "justify-center"
              )}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary text-foreground">
                <Building2 className="h-4 w-4" />
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 truncate">
                    <p className="truncate text-sm font-medium text-foreground">
                      {activeCompany.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {activeCompany.founders.length} founder{activeCompany.founders.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {companies.map((company) => (
              <DropdownMenuItem
                key={company.id}
                onClick={() => setActiveCompanyId(company.id)}
                className={cn(
                  activeCompany.id === company.id && "bg-secondary"
                )}
              >
                <Building2 className="mr-2 h-4 w-4" />
                {company.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Navigation */}
      {!collapsed && (
        <nav className="flex-1 overflow-y-auto p-3">
          {/* Goals section */}
          <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Goals
          </p>
          <div className="mb-4 flex flex-col gap-0.5">
            {goalItems.map((item) => {
              const Icon = item.icon
              const isActive = activeSection === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => onSectionChange(item.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.tag && (
                    <span
                      className={cn(
                        "text-[11px] tabular-nums",
                        isActive ? "text-primary/70" : "text-muted-foreground/60"
                      )}
                    >
                      {item.tag}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Metrics section */}
          <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Reporting
          </p>
          <div className="mb-4 flex flex-col gap-0.5">
            <button
              onClick={() => onSectionChange("metrics")}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                activeSection === "metrics"
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <BarChart3 className="h-4 w-4 shrink-0" />
              <span className="flex-1">Monthly Metrics</span>
            </button>
          </div>

          {/* Archive section */}
          <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            History
          </p>
          <div className="flex flex-col gap-0.5">
            <button
              onClick={() => onSectionChange("archive")}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                activeSection === "archive"
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Archive className="h-4 w-4 shrink-0" />
              <span className="flex-1">Archive</span>
            </button>
          </div>
        </nav>
      )}

      {/* Collapsed nav icons */}
      {collapsed && (
        <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto py-3">
          {goalItems.map((item) => {
            const Icon = item.icon
            const isActive = activeSection === item.id
            return (
              <button
                key={item.id}
                onClick={() => onSectionChange(item.id)}
                title={item.label}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            )
          })}
          <div className="my-2 h-px w-6 bg-border" />
          <button
            onClick={() => onSectionChange("metrics")}
            title="Monthly Metrics"
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
              activeSection === "metrics"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <BarChart3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => onSectionChange("archive")}
            title="Archive"
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
              activeSection === "archive"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <Archive className="h-4 w-4" />
          </button>
        </nav>
      )}

      {/* Coach */}
      <div className="border-t border-border p-3">
        <div
          className={cn(
            "flex items-center gap-2.5",
            collapsed && "justify-center"
          )}
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/20 text-xs text-primary">
              {coach.avatar}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div>
              <p className="text-sm font-medium text-foreground">{coach.name}</p>
              <p className="text-xs text-muted-foreground">Coach</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
