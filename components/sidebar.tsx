"use client"

import { useApp } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Building2, ChevronDown, Compass } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const { coach, companies, activeCompany, setActiveCompanyId } = useApp()

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
                      {activeCompany.founders.length} founders
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

      {/* Founders */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto p-3">
          <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Founders
          </p>
          <div className="flex flex-col gap-1">
            {activeCompany.founders.map((founder) => (
              <div
                key={founder.id}
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5"
              >
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-secondary text-xs text-foreground">
                    {founder.avatar}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm text-foreground">{founder.name}</p>
                  <p className="text-xs text-muted-foreground">{founder.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
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
