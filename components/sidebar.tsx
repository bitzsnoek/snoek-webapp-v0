"use client"

import { useState } from "react"
import { useApp } from "@/lib/store"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import {
  Building2,
  ChevronDown,
  Target,
  BarChart3,
  Archive,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  LogOut,
  Calendar,
  MessageCircle,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

export type MainSection = "goals" | "metrics" | "meetings" | "chat" | "automations" | "archive" | "settings" | "account"

const mainNavItems: { id: MainSection; label: string; icon: typeof Target; coachOnly?: boolean }[] = [
  { id: "goals", label: "Goals", icon: Target },
  { id: "metrics", label: "Monthly Metrics", icon: BarChart3 },
  { id: "meetings", label: "Meetings", icon: Calendar },
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "automations", label: "Automations", icon: Zap, coachOnly: true },
]

const bottomNavItems: { id: MainSection; label: string; icon: typeof Target }[] = [
  { id: "archive", label: "Archive", icon: Archive },
  { id: "settings", label: "Company Settings", icon: Settings },
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
  const { currentUser, companies, activeCompany, setActiveCompanyId, addCompany } = useApp()
  const router = useRouter()
  const [addCompanyOpen, setAddCompanyOpen] = useState(false)
  const [newCompanyName, setNewCompanyName] = useState("")
  const [addingCompany, setAddingCompany] = useState(false)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  function handleNavClick(section: MainSection) {
    onSectionChange(section)
    onMobileClose()
  }

  async function handleAddCompany() {
    const name = newCompanyName.trim()
    if (!name) return
    setAddingCompany(true)
    await addCompany(name)
    setAddingCompany(false)
    setNewCompanyName("")
    setAddCompanyOpen(false)
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2">
          <img 
            src="/images/snoek-logo.png" 
            alt="Snoek" 
            className="h-8 w-8 shrink-0"
          />
          {!collapsed && (
            <span className="text-[22px] font-bold text-foreground font-logo">
              Snoek
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
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setAddCompanyOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add company
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Navigation */}
      {!collapsed && (
        <nav className="flex flex-1 flex-col overflow-y-auto p-3">
          <div className="flex flex-col gap-0.5">
            {mainNavItems
              .filter((item) => !item.coachOnly || currentUser.role === "coach")
              .map((item) => {
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
          {/* Bottom nav items */}
          <div className="mt-auto flex flex-col gap-0.5 pt-3">
            {bottomNavItems.map((item) => {
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
          {mainNavItems
            .filter((item) => !item.coachOnly || currentUser.role === "coach")
            .map((item) => {
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
          {/* Bottom nav items */}
          <div className="mt-auto flex flex-col items-center gap-1">
            {bottomNavItems.map((item) => {
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
          </div>
        </nav>
      )}

      {/* User area and collapse button */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2.5 justify-between">
          <button
            onClick={() => { handleNavClick("account"); }}
            className={cn(
              "flex items-center gap-2.5 rounded-lg transition-colors hover:bg-secondary p-1 -m-1",
              collapsed && "justify-center flex-1",
              activeSection === "account" && "bg-primary/10"
            )}
            title="Account settings"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className={cn(
                "text-xs",
                activeSection === "account" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {currentUser.avatar || currentUser.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="text-left">
                <p className="text-sm font-medium text-foreground">{currentUser.name || "User"}</p>
                <p className="text-xs text-muted-foreground capitalize">{currentUser.role}</p>
              </div>
            )}
          </button>
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
      {/* Add company dialog */}
      <Dialog open={addCompanyOpen} onOpenChange={(open) => { if (!open) { setAddCompanyOpen(false); setNewCompanyName("") } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Company</DialogTitle>
            <DialogDescription>Add a new company to coach.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-company-name">Company name</Label>
              <Input
                id="new-company-name"
                placeholder="Acme Inc."
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddCompany()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddCompanyOpen(false); setNewCompanyName("") }}>
              Cancel
            </Button>
            <Button onClick={handleAddCompany} disabled={!newCompanyName.trim() || addingCompany}>
              {addingCompany ? "Adding..." : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
