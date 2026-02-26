"use client"

import { useApp } from "@/lib/store"
import { cn } from "@/lib/utils"
import {
  Building2,
  ChevronDown,
  Compass,
  Target,
  BarChart3,
  Archive,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"

export type MainSection = "goals" | "metrics" | "archive" | "settings"

const navItems: { id: MainSection; label: string; icon: typeof Target }[] = [
  { id: "goals", label: "Goals", icon: Target },
  { id: "metrics", label: "Monthly Metrics", icon: BarChart3 },
  { id: "archive", label: "Archive", icon: Archive },
  { id: "settings", label: "Settings", icon: Settings },
]

interface SidebarProps {
  collapsed: boolean
  activeSection: MainSection
  onSectionChange: (section: MainSection) => void
  onCollapse: (collapsed: boolean) => void
  mobileOpen: boolean
  onMobileClose: () => void
}

export function Sidebar({
  collapsed,
  activeSection,
  onSectionChange,
  onCollapse,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const { coach, companies, activeCompany, setActiveCompanyId } = useApp()

  function handleNavClick(section: MainSection) {
    onSectionChange(section)
    onMobileClose()
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
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
        {/* Mobile close button */}
        <button
          onClick={onMobileClose}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden"
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5" />
        </button>
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
          <div className="flex flex-col gap-0.5">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeSection === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 md:py-2 text-left text-sm transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                </button>
              )
            })}
          </div>
        </nav>
      )}

      {/* Collapsed nav icons */}
      {collapsed && (
        <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto py-3">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeSection === item.id
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
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
        </nav>
      )}

      {/* Coach and collapse button */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2.5 justify-between">
          <div
            className={cn(
              "flex items-center gap-2.5",
              collapsed && "justify-center flex-1"
            )}
          >
            <Avatar className="h-8 w-8">
              {coach.avatar.startsWith("/") && <AvatarImage src={coach.avatar} alt={coach.name} />}
              <AvatarFallback className="bg-primary/20 text-xs text-primary">
                {coach.avatar.startsWith("/") ? coach.name.split(" ").map((n) => n[0]).join("") : coach.avatar}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div>
                <p className="text-sm font-medium text-foreground">{coach.name}</p>
                <p className="text-xs text-muted-foreground">Coach</p>
              </div>
            )}
          </div>
          {/* Collapse toggle - desktop only */}
          <button
            onClick={() => onCollapse(!collapsed)}
            className="hidden md:flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-card transition-transform duration-200 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-border bg-card transition-all duration-200",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
