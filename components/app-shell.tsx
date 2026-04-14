"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { useApp } from "@/lib/store"
import { isCoachOrAdmin, hasFeature, hasPrioritiesBoard, getActiveBoards } from "@/lib/mock-data"
import { createClient } from "@/lib/supabase/client"
import { Sidebar, type MainSection } from "./sidebar"
import { YearlyGoals } from "./yearly-goals"
import { QuarterlyGoals } from "./quarterly-goals"
import { MonthlyPriorities } from "./monthly-priorities"
import { RealtimeGoalsProvider } from "@/lib/realtime-goals-context"
import { RealtimeConnectionStatus, ActiveEditorsIndicator } from "@/components/editing-indicator"
import { StandardGoalsBoard } from "./standard-goals-board"
import { MonthlyMetrics } from "./monthly-metrics"
import MeetingsSection from "./meetings-section"
import { ChatSection, type ChatTab } from "./chat-section"
import { JournalsSection } from "./journals-section"
import { AutomationsSection } from "./automations-section"
import { ArchiveView } from "./archive-view"
import { ClientSettings } from "./client-settings"
import { AccountSettings } from "./account-settings"

import { Building2, Plus, Archive, Menu } from "lucide-react"
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

type GoalTabId = `year-${string}` | `quarter-${string}` | `board-${string}` | "priorities"

type AddDialogType = "year" | "quarter" | "board" | null

export function AppShell() {
  const { activeClient, clients, addYear, addQuarter, archiveTab, archiveBoard, addClient, addGoalBoard, isLoading, currentUser } = useApp()
  const [activeSection, setActiveSection] = useState<MainSection>("goals")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Active tab id: "year-{yearId}", "quarter-{quarterId}", or "priorities"
  const [activeTabId, setActiveTabId] = useState<GoalTabId>("priorities")

  // Chat state
  const [chatTabs, setChatTabs] = useState<ChatTab[]>([])
  const [selectedChatTab, setSelectedChatTab] = useState<ChatTab | null>(null)
  const [chatLoading, setChatLoading] = useState(false)

  // Fetch chat tabs when chat section is active
  const fetchChatTabs = useCallback(async () => {
    if (!activeClient.id || !currentUser.id) return
    
    setChatLoading(true)
    const supabase = createClient()

    try {
      // Get all members of the client (members if coach, coaches if member)
      const allMembers = activeClient.allMembers || []
      const relevantMembers = allMembers.filter((m) => {
        if (isCoachOrAdmin(currentUser.role)) {
          return m.role === "member"
        }
        return m.role === "coach"
      })

      // Fetch conversations for this client (including group chat)
      const { data: convos, error: convosError } = await supabase
        .from("conversations")
        .select("*")
        .eq("client_id", activeClient.id)

      if (convosError) throw convosError

      // Find existing group conversation (don't auto-create)
      const groupConvo = (convos ?? []).find((c) => c.is_group === true)

      // Get profile mappings to match conversations to members by name
      const allUserIds = [...new Set([
        ...(convos ?? []).map((c) => c.member_id).filter(Boolean),
        ...(convos ?? []).map((c) => c.coach_id).filter(Boolean)
      ])]

      let profileMap: Record<string, string> = {}
      if (allUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", allUserIds)

        profileMap = Object.fromEntries(
          (profiles ?? []).map((p) => [p.id, p.full_name])
        )
      }

      // Build tabs - start with group chat tab
      const tabs: ChatTab[] = []
      
      // Add group chat tab first (client name)
      if (groupConvo) {
        tabs.push({
          odooUserId: "",
          odooMemberId: "",
          name: activeClient.name,
          conversationId: groupConvo.id,
          isGroup: true
        })
      }

      // Add individual member tabs
      relevantMembers.forEach((member) => {
        // Find conversation where the member's name matches either founder or coach name
        // Only consider non-group conversations
        const convo = (convos ?? []).find((c) => {
          if (c.is_group) return false
          const memberName = profileMap[c.member_id]
          const coachName = profileMap[c.coach_id]

          if (isCoachOrAdmin(currentUser.role)) {
            return memberName === member.name
          }
          return coachName === member.name
        })

        tabs.push({
          odooUserId: member.userId || "",
          odooMemberId: member.id,
          name: member.name,
          conversationId: convo?.id,
          supabaseUserId: convo ? (isCoachOrAdmin(currentUser.role) ? convo.member_id : convo.coach_id) : undefined,
          isGroup: false
        })
      })

      setChatTabs(tabs)
      
      // Select first tab by default if none selected
      if (tabs.length > 0 && !selectedChatTab) {
        setSelectedChatTab(tabs[0])
      }
    } catch (err) {
      console.error("Error fetching chat tabs:", err)
    } finally {
      setChatLoading(false)
    }
  }, [activeClient.id, activeClient.allMembers, currentUser.id, currentUser.role, selectedChatTab])

  // Fetch chat tabs when switching to chat section or client changes
  useEffect(() => {
    if (activeSection === "chat") {
      fetchChatTabs()
    }
  }, [activeSection, activeClient.id, fetchChatTabs])

  // Reset selected chat tab when client changes
  useEffect(() => {
    setSelectedChatTab(null)
    setChatTabs([])
  }, [activeClient.id])

  // "Add tab" dialog state
  const [addDialog, setAddDialog] = useState<AddDialogType>(null)
  const [addValue, setAddValue] = useState("")
  const [addError, setAddError] = useState("")

  const activeYears = activeClient.years.filter((y) => y.isActive)
  const activeQuarters = activeClient.quarters.filter((q) => q.isActive)

  // Set default tab to first quarter when data loads
  const firstQuarter = activeQuarters[0]
  if (activeTabId === "priorities" && firstQuarter && !isLoading) {
    // Keep priorities as default - that's fine
  }

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

  const sortedBoards = useMemo(
    () => getActiveBoards(activeClient).filter((b) => b.boardType === "standard"),
    [activeClient]
  )

  const showOkr = hasFeature(activeClient, "okr")
  const showPriorities = hasPrioritiesBoard(activeClient)

  // Derive active content from tab id
  const activeYearId = activeTabId.startsWith("year-")
    ? activeTabId.replace("year-", "")
    : null
  const activeQuarterId = activeTabId.startsWith("quarter-")
    ? activeTabId.replace("quarter-", "")
    : null
  const activeBoardId = activeTabId.startsWith("board-")
    ? activeTabId.replace("board-", "")
    : null

  const activeYear = sortedYears.find((y) => y.id === activeYearId) ?? null
  const activeQuarter = sortedQuarters.find((q) => q.id === activeQuarterId) ?? null
  const activeBoard = sortedBoards.find((b) => b.id === activeBoardId) ?? null

  function formatYearLabel(year: number) {
    return String(year)
  }

  function formatQuarterLabel(label: string, year: number) {
    const q = label.split(" ")[0] // "Q1"
    return `${q} '${String(year).slice(-2)}`
  }

  function handleArchive(type: "year" | "quarter" | "board", id: string) {
    if (type === "board") {
      archiveBoard(id)
    } else {
      archiveTab(type, id)
    }
    // Switch to a still-active tab
    if (type === "year") {
      const remaining = sortedYears.filter((y) => y.id !== id)
      if (remaining.length > 0) setActiveTabId(`year-${remaining[0].id}`)
      else if (sortedQuarters.length > 0)
        setActiveTabId(`quarter-${sortedQuarters[0].id}`)
      else if (sortedBoards.length > 0) setActiveTabId(`board-${sortedBoards[0].id}`)
      else setActiveTabId("priorities")
    } else if (type === "quarter") {
      const remaining = sortedQuarters.filter((q) => q.id !== id)
      if (remaining.length > 0) setActiveTabId(`quarter-${remaining[0].id}`)
      else if (sortedYears.length > 0) setActiveTabId(`year-${sortedYears[0].id}`)
      else if (sortedBoards.length > 0) setActiveTabId(`board-${sortedBoards[0].id}`)
      else setActiveTabId("priorities")
    } else {
      const remaining = sortedBoards.filter((b) => b.id !== id)
      if (remaining.length > 0) setActiveTabId(`board-${remaining[0].id}`)
      else if (sortedQuarters.length > 0) setActiveTabId(`quarter-${sortedQuarters[0].id}`)
      else if (sortedYears.length > 0) setActiveTabId(`year-${sortedYears[0].id}`)
      else setActiveTabId("priorities")
    }
  }

  function openAddDialog(type: "year" | "quarter" | "board") {
    setAddDialog(type)
    setAddValue("")
    setAddError("")
  }

  async function handleAddConfirm() {
    if (addDialog === "year") {
      const yr = parseInt(addValue.trim())
      if (isNaN(yr) || yr < 2000 || yr > 2100) {
        setAddError("Enter a valid year (e.g. 2026)")
        return
      }
      const exists = [...activeYears, ...activeClient.years.filter(y => !y.isActive)].some(
        (y) => y.year === yr
      )
      if (exists) {
        setAddError("A board for this year already exists")
        return
      }
      addYear(yr)
      setAddDialog(null)
      setTimeout(() => {
        const client = activeClient
        const newYear = client.years.find((y) => y.year === yr)
        if (newYear) setActiveTabId(`year-${newYear.id}`)
      }, 50)
    } else if (addDialog === "quarter") {
      const raw = addValue.trim().toUpperCase()
      const match = raw.match(/^Q([1-4])\s*(\d{4})?$/)
      if (!match) {
        setAddError('Enter a quarter like "Q2" or "Q2 2026"')
        return
      }
      const qNum = parseInt(match[1])
      const year = match[2] ? parseInt(match[2]) : new Date().getFullYear()
      const label = `Q${qNum} ${year}`
      const exists = [...activeQuarters, ...activeClient.quarters.filter(q => !q.isActive)].some(
        (q) => q.label === label
      )
      if (exists) {
        setAddError(`A board for ${label} already exists`)
        return
      }
      addQuarter(label, year)
      setAddDialog(null)
      setTimeout(() => {
        const client = activeClient
        const newQ = client.quarters.find((q) => q.label === label)
        if (newQ) setActiveTabId(`quarter-${newQ.id}`)
      }, 50)
    } else if (addDialog === "board") {
      const title = addValue.trim()
      if (!title) {
        setAddError("Enter a board name")
        return
      }
      const newId = await addGoalBoard(title, "standard")
      setAddDialog(null)
      setActiveTabId(`board-${newId}`)
    }
  }

  const [newClientName, setNewClientName] = useState("")
  const [creatingClient, setCreatingClient] = useState(false)

  async function handleCreateFirstClient() {
    const name = newClientName.trim()
    if (!name) return
    setCreatingClient(true)
    await addClient(name)
    setCreatingClient(false)
    setNewClientName("")
  }

  if (isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
            <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
          <p className="text-muted-foreground">Loading data...</p>
        </div>
      </div>
    )
  }

  if (clients.length === 0) {
    // Coaches can create clients, members need to wait for an invitation
    if (isCoachOrAdmin(currentUser.role)) {
      return (
        <div className="flex h-dvh items-center justify-center bg-background p-6">
          <div className="w-full max-w-sm text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">Welcome to Snoek</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Get started by adding your first client to coach.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Input
                placeholder="Client name"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateFirstClient()}
                className="text-center"
              />
              <Button onClick={handleCreateFirstClient} disabled={!newClientName.trim() || creatingClient}>
                {creatingClient ? "Creating..." : "Add client"}
              </Button>
            </div>
          </div>
        </div>
      )
    }

    // Member with no clients - they were removed or haven't been invited yet
    return (
      <div className="flex h-dvh items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <Building2 className="h-7 w-7 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">No Client Access</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You are not currently connected to any client. This can happen if you were removed from a client or if your invitation is still pending.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Please contact your coach to request an invitation.
          </p>
          <div className="mt-6">
            <Button 
              variant="outline" 
              onClick={async () => {
                const supabase = createClient()
                await supabase.auth.signOut()
                window.location.href = "/"
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        collapsed={sidebarCollapsed}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onCollapse={setSidebarCollapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-12 shrink-0 items-center border-b border-border bg-background px-3 md:px-4 gap-2">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Goals tab bar */}
          {activeSection === "goals" && (
            <div className="flex h-full min-w-0 flex-1 items-stretch gap-0.5 overflow-x-auto scrollbar-none">
              {/* Year tabs (OKR only) */}
              {showOkr && sortedYears.map((year) => {
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

              {/* Quarter tabs (OKR only) */}
              {showOkr && sortedQuarters.map((quarter) => {
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

              {/* Standard goal boards */}
              {sortedBoards.map((board) => {
                const tabId: GoalTabId = `board-${board.id}`
                const isActive = activeTabId === tabId
                return (
                  <GoalTab
                    key={board.id}
                    label={board.title}
                    isActive={isActive}
                    onClick={() => setActiveTabId(tabId)}
                    onArchive={() => handleArchive("board", board.id)}
                  />
                )
              })}

              {/* Priorities tab (only if a priorities board exists) */}
              {showPriorities && (
                <GoalTab
                  label="Priorities"
                  isActive={activeTabId === "priorities"}
                  onClick={() => setActiveTabId("priorities")}
                />
              )}

              {/* Add board button */}
              {isCoachOrAdmin(currentUser.role) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center self-center rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                      aria-label="Add new board"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={8}>
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      Add new board
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => openAddDialog("board")}>
                      Goals Board
                    </DropdownMenuItem>
                    {!showPriorities && (
                      <DropdownMenuItem onClick={async () => {
                        const newId = await addGoalBoard("Priorities", "priorities")
                        setActiveTabId("priorities")
                      }}>
                        Priorities
                      </DropdownMenuItem>
                    )}
                    {showOkr && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs text-muted-foreground">
                          OKR
                        </DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => openAddDialog("year")}>
                          Yearly Goals
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openAddDialog("quarter")}>
                          Quarterly Goals
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}

          {/* Chat tabs */}
          {activeSection === "chat" && (
            <div className="flex h-full min-w-0 flex-1 items-stretch gap-0.5 overflow-x-auto scrollbar-none">
              {chatLoading ? (
                <div className="flex items-center px-3">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : chatTabs.length === 0 ? (
                <span className="flex items-center px-3 text-sm text-muted-foreground">
                  No {isCoachOrAdmin(currentUser.role) ? "members" : "coaches"} in this client
                </span>
              ) : (
                <>
                  {chatTabs.map((tab) => {
                    const isActive = tab.isGroup 
                      ? selectedChatTab?.isGroup === true
                      : selectedChatTab?.odooMemberId === tab.odooMemberId
                    return (
                      <button
                        key={tab.isGroup ? "group" : tab.odooMemberId}
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setSelectedChatTab(tab)}
                        className={cn(
                          "relative flex shrink-0 items-center px-3 text-sm whitespace-nowrap transition-colors",
                          isActive
                            ? "font-medium text-success"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {tab.name}
                        {isActive && (
                          <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-success" />
                        )}
                      </button>
                    )
                  })}
                  {/* Show "Create Group Chat" button for coaches when no group chat exists */}
                  {isCoachOrAdmin(currentUser.role) && !chatTabs.some(t => t.isGroup) && (
                    <button
                      onClick={async () => {
                        const supabase = createClient()
                        try {
                          const { data: newGroupConvo, error } = await supabase
                            .from("conversations")
                            .insert({
                              client_id: activeClient.id,
                              coach_id: currentUser.id,
                              is_group: true,
                              name: activeClient.name
                            })
                            .select()
                            .single()
                          
                          if (!error && newGroupConvo) {
                            // Refresh chat tabs
                            fetchChatTabs()
                          }
                        } catch (err) {
                          console.error("Error creating group chat:", err)
                        }
                      }}
                      className="ml-1 flex h-7 shrink-0 items-center gap-1 self-center rounded-md border border-dashed border-border px-2 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                      title="Create group chat for this client"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Group Chat</span>
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Section title for non-Goals/non-Chat sections */}
          {activeSection !== "goals" && activeSection !== "chat" && (
            <h1 className="text-sm font-medium text-foreground">
              {activeSection === "metrics"
                  ? "Monthly Metrics"
                  : activeSection === "meetings"
                  ? "Meetings"
                  : activeSection === "journals"
                  ? "Journals"
                  : activeSection === "automations"
                  ? "Automations"
                  : activeSection === "settings"
                ? "Client Settings"
                : activeSection === "account"
                ? "Account"
                : "Archive"}
            </h1>
          )}
        </header>

        {/* Content */}
        <main className={cn(
          "flex-1 overflow-y-auto",
          activeSection === "chat" ? "" : "p-4 md:p-6"
        )}>
          {activeSection === "goals" && (
            <RealtimeGoalsProvider>
              {/* Realtime status bar */}
              <div className="mb-4 flex items-center justify-between">
                <ActiveEditorsIndicator />
                <RealtimeConnectionStatus />
              </div>
              {activeTabId === "priorities" && <MonthlyPriorities />}
              {activeYear && <YearlyGoals years={[activeYear]} />}
              {activeQuarter && <QuarterlyGoals quarters={[activeQuarter]} years={activeYears} />}
              {activeBoard && <StandardGoalsBoard board={activeBoard} />}
            </RealtimeGoalsProvider>
          )}
          {activeSection === "metrics" && <MonthlyMetrics />}
          {activeSection === "meetings" && <MeetingsSection />}
          {activeSection === "chat" && <ChatSection selectedTab={selectedChatTab} />}
          {activeSection === "journals" && <JournalsSection />}
          {activeSection === "automations" && <AutomationsSection />}
          {activeSection === "archive" && <ArchiveView />}
          {activeSection === "settings" && <ClientSettings />}
          {activeSection === "account" && <AccountSettings />}
        </main>
      </div>

      {/* Add Board Dialog */}
      <Dialog open={addDialog !== null} onOpenChange={(open) => !open && setAddDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {addDialog === "year"
                ? "Add Yearly Goals Board"
                : addDialog === "quarter"
                ? "Add Quarterly Goals Board"
                : "Add Goals Board"}
            </DialogTitle>
            <DialogDescription>
              {addDialog === "year"
                ? "Enter the year for the new board (e.g. 2026)."
                : addDialog === "quarter"
                ? 'Enter the quarter and year (e.g. "Q2" or "Q2 2026").'
                : "Enter a name for the new goals board."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <Label htmlFor="add-tab-value">
              {addDialog === "year" ? "Year" : addDialog === "quarter" ? "Quarter" : "Board name"}
            </Label>
            <Input
              id="add-tab-value"
              placeholder={addDialog === "year" ? "2026" : addDialog === "quarter" ? "Q2 2026" : "e.g. Growth Goals"}
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
            <Button onClick={handleAddConfirm}>Add board</Button>
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
    <div className="group relative flex h-full shrink-0 items-stretch">
      <button
        role="tab"
        aria-selected={isActive}
        onClick={onClick}
        className={cn(
          "relative flex items-center gap-1 px-3 text-sm whitespace-nowrap transition-colors",
          isActive
            ? "font-medium text-success"
            : "text-muted-foreground hover:text-foreground",
          onArchive && "pr-2"
        )}
      >
        {label}
        {isActive && (
          <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-success" />
        )}
      </button>

      {/* Archive button — only shown on hover, only when archiveable */}
      {onArchive && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onArchive()
          }}
          title="Archive this board"
          className={cn(
            "hidden md:flex items-center self-center rounded-sm p-0.5 text-muted-foreground/40 opacity-0 transition-all hover:text-muted-foreground group-hover:opacity-100",
            isActive && "text-muted-foreground/60"
          )}
          aria-label="Archive board"
        >
          <Archive className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
