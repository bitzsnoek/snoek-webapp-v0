"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import { fetchUserClients, fetchAllClients, dbUpdateWeeklyValue, dbAddYearlyGoal, dbUpdateYearlyGoal, dbDeleteYearlyGoal, dbUpdateYearlyKRConfidence, dbAddQuarterlyGoal, dbUpdateQuarterlyGoal, dbDeleteQuarterlyGoal, dbAddKeyResult, dbUpdateKeyResult, dbDeleteKeyResult, dbAssignKROwner, dbUpdateClientName, dbAddMember, dbUpdateMember, dbRemoveMember, dbUpdateMetricValue, dbAddMetric, dbDeleteMetric, dbArchiveQuarter, dbArchiveYear, dbAddYear, dbAddQuarter, fetchClientData, dbAddClient, dbDeleteClient, dbInviteUser, dbGetInvitations, dbCancelInvitation, dbAcceptInvitation, dbGetUnconnectedMembers, dbReorderYearlyGoals, dbReorderYearlyKeyResults, dbReorderQuarterlyGoals, dbReorderQuarterlyKeyResults, dbUpdateClientFeatures, dbAddGoalBoard, dbUpdateGoalBoard, dbArchiveGoalBoard, dbDeleteGoalBoard, dbAddStandardGoal, dbUpdateStandardGoal, dbDeleteStandardGoal, dbAssignStandardGoalOwner, dbUpdateStandardGoalValue, dbReorderStandardGoals, dbAddJournal, dbUpdateJournal, dbDeleteJournal, dbUpsertJournalEntry, type Invitation, type UnconnectedMember } from "./supabase-data"
import type { Client, Coach, CurrentUser, KeyResult, YearlyKeyResult, Confidence, Metric, GoalBoard, StandardGoal, GoalType, ValueType, GoalFrequency, BoardType } from "./mock-data"

interface AppState {
  isLoading: boolean
  coach: Coach
  currentUser: CurrentUser
  clients: Client[]
  activeClientId: string
  activeClient: Client
  setActiveClientId: (id: string) => void
  setClients: React.Dispatch<React.SetStateAction<Client[]>>
  updateWeeklyValue: (keyResultId: string, week: string, value: number) => void
  addYear: (year: number) => string
  addQuarter: (label: string, year: number) => string
  archiveTab: (type: "year" | "quarter", id: string) => void
  unarchiveTab: (type: "year" | "quarter", id: string) => void
  addQuarterlyGoal: (quarterId: string, objective: string, yearlyGoalId: string) => Promise<string>
  updateQuarterlyGoal: (quarterId: string, goalId: string, objective: string, yearlyGoalId: string) => void
  deleteQuarterlyGoal: (quarterId: string, goalId: string) => void
  addKeyResult: (quarterId: string, goalId: string, kr: Omit<KeyResult, "id">) => Promise<void>
  updateKeyResult: (quarterId: string, goalId: string, krId: string, kr: Partial<KeyResult>) => void
  deleteKeyResult: (quarterId: string, goalId: string, krId: string) => void
  updateYearlyKRConfidence: (yearId: string, goalId: string, krId: string, confidence: Confidence) => void
  assignKROwner: (quarterId: string, goalId: string, krId: string, owner: string | null) => void
  addYearlyGoal: (yearId: string, objective: string, keyResults: string[]) => void
  updateYearlyGoal: (yearId: string, goalId: string, objective: string, keyResults: Omit<YearlyKeyResult, "id">[]) => void
  deleteYearlyGoal: (yearId: string, goalId: string) => void
  updateClientName: (name: string) => void
  addMember: (name: string, role: string) => void
  updateMember: (memberId: string, name: string, role: string, emails?: string[]) => void
  removeMember: (memberId: string) => void
  removeClientMember: (memberId: string) => void
  updateMetricValue: (metricId: string, month: number, value: number) => void
  addMetric: (metric: Omit<Metric, "id">) => void
  deleteMetric: (metricId: string) => void
  addClient: (name: string) => Promise<void>
  deleteClient: (clientId: string) => Promise<void>
  inviteUser: (email: string, role: "member" | "coach", memberId?: string) => Promise<Invitation | null>
  getInvitations: () => Promise<Invitation[]>
  cancelInvitation: (invitationId: string) => Promise<void>
  acceptInvitation: (token: string) => Promise<{ success: boolean; clientId?: string; error?: string }>
  updateProfile: (name: string) => Promise<void>
  refreshData: () => Promise<void>
  reorderYearlyGoals: (yearId: string, fromIndex: number, toIndex: number) => void
  reorderYearlyKeyResults: (yearId: string, goalId: string, fromIndex: number, toIndex: number) => void
  reorderQuarterlyGoals: (quarterId: string, fromIndex: number, toIndex: number) => void
  reorderQuarterlyKeyResults: (quarterId: string, goalId: string, fromIndex: number, toIndex: number) => void
  // Goal boards & standard goals
  updateClientFeatures: (features: string[]) => void
  addGoalBoard: (title: string, boardType: BoardType) => Promise<string>
  updateGoalBoard: (boardId: string, title: string) => void
  archiveBoard: (boardId: string) => void
  unarchiveBoard: (boardId: string) => void
  deleteGoalBoard: (boardId: string) => void
  addStandardGoal: (boardId: string, goal: Omit<StandardGoal, "id" | "values">) => Promise<string>
  updateStandardGoal: (boardId: string, goalId: string, updates: Partial<StandardGoal>) => void
  deleteStandardGoal: (boardId: string, goalId: string) => void
  updateStandardGoalValue: (boardId: string, goalId: string, periodKey: string, value: number) => void
  assignStandardGoalOwner: (boardId: string, goalId: string, owner: string | null) => void
  reorderStandardGoals: (boardId: string, fromIndex: number, toIndex: number) => void
  // Journals
  addJournal: (title: string, description: string | undefined, frequency: string, assignedMemberId: string | null) => Promise<string>
  updateJournal: (journalId: string, updates: { title?: string; description?: string; frequency?: string; assignedMemberId?: string | null; archived?: boolean }) => void
  deleteJournal: (journalId: string) => void
  archiveJournal: (journalId: string) => void
  upsertJournalEntry: (journalId: string, periodKey: string, content: string) => void
  // Cross-section navigation: when set, app-shell switches to the journals
  // section and the journals view opens this (journal, period). Consumers
  // should clear it after handling so the effect is one-shot.
  pendingJournalNav: { journalId: string; periodKey: string } | null
  setPendingJournalNav: (nav: { journalId: string; periodKey: string } | null) => void
}

const AppContext = createContext<AppState | null>(null)

const emptyClient: Client = {
  id: "",
  name: "",
  features: [],
  members: [],
  allMembers: [],
  years: [],
  quarters: [],
  boards: [],
  metrics: [],
  journals: [],
}

const defaultCoach: Coach = {
  id: "coach",
  name: "Coach",
  avatar: "",
  clientIds: [],
}

const defaultUser: CurrentUser = {
  id: "",
  name: "",
  email: "",
  avatar: "",
  role: "member",
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>([])
  const [activeClientId, setActiveClientId] = useState("")
  const [currentUser, setCurrentUser] = useState<CurrentUser>(defaultUser)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pendingJournalNav, setPendingJournalNav] = useState<{ journalId: string; periodKey: string } | null>(null)

  const activeClient = clients.find((c) => c.id === activeClientId) ?? clients[0] ?? emptyClient

  // Clear all user data (used on logout or session change)
  const clearUserData = useCallback(() => {
    setClients([])
    setActiveClientId("")
    setCurrentUser(defaultUser)
  }, [])

  // Load data from Supabase on mount
  const loadData = useCallback(async () => {
    try {
      setLoadError(null)
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        // Clear any existing data when no session
        clearUserData()
        setLoadError("No active session found. Please log in.")
        return
      }

      // Load user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, is_super_admin")
        .eq("id", session.user.id)
        .single()

      const isSuperAdmin = profile?.is_super_admin === true

      // Determine user role: check if they own any client OR are a coach in any client
      const { data: ownedClients } = await supabase
        .from("clients")
        .select("id")
        .eq("coach_id", session.user.id)
        .limit(1)

      const { data: coachMemberships } = await supabase
        .from("client_members")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("role", "coach")
        .limit(1)

      const userRole = isSuperAdmin
        ? "super_admin" as const
        : (ownedClients && ownedClients.length > 0) || (coachMemberships && coachMemberships.length > 0) ? "coach" : "member"
      const userName = profile?.full_name || session.user.email?.split("@")[0] || "User"
      const initials = userName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)

      setCurrentUser({
        id: session.user.id,
        name: userName,
        email: session.user.email || "",
        avatar: initials,
        role: userRole,
      })

      const data = isSuperAdmin
        ? await fetchAllClients()
        : await fetchUserClients(session.user.id)
      setClients(data)
      if (data.length > 0) {
        // Preserve current active client if it still exists, otherwise default to first
        setActiveClientId((current) => {
          if (current && data.some((c) => c.id === current)) return current
          return data[0].id
        })
      }
    } catch (err) {
      console.error("[v0] Failed to load data:", err)
      setLoadError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    
    // Listen for auth state changes to clear data on logout or user switch
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        // Clear all data immediately when user signs out
        clearUserData()
        setIsLoading(false)
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        // Reload data for new user (or refreshed session)
        loadData()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [loadData, clearUserData])

  // Helper to refresh a single client after mutations.
  // Merges DB data with optimistic state to avoid losing locally-added items
  // (e.g. a quarter tab added while a yearly goal save is in flight).
  async function refreshClient(clientId: string) {
    const updated = await fetchClientData(clientId)
    if (updated) {
      setClients((prev) => prev.map((c) => {
        if (c.id !== clientId) return c
        // Merge years: keep any optimistic years not yet in DB
        const dbYearIds = new Set(updated.years.map((y) => y.id))
        const optimisticYears = c.years.filter((y) => !dbYearIds.has(y.id))
        // Merge quarters: keep any optimistic quarters not yet in DB
        const dbQuarterIds = new Set(updated.quarters.map((q) => q.id))
        const optimisticQuarters = c.quarters.filter((q) => !dbQuarterIds.has(q.id))
        return {
          ...updated,
          years: [...updated.years, ...optimisticYears],
          quarters: [...updated.quarters, ...optimisticQuarters],
        }
      }))
    }
  }

  // Helper to get owner member ID from name (checks all members)
  function getOwnerMemberId(ownerName: string | null): string | null {
    if (!ownerName) return null
    const member = activeClient.allMembers?.find((m) => m.name === ownerName)
      ?? activeClient.members.find((f) => f.name === ownerName)
    return member?.id ?? null
  }

  // Parse quarter key into year + quarter number
  function parseQuarterKey(quarterId: string): { year: number; quarter: number } {
    // quarterId could be "2025-1" or the old format "q1-2025"
    const parts = quarterId.split("-")
    if (parts.length === 2 && !isNaN(parseInt(parts[0])) && !isNaN(parseInt(parts[1]))) {
      return { year: parseInt(parts[0]), quarter: parseInt(parts[1]) }
    }
    // Try matching Q1 2025 format
    const match = quarterId.match(/[qQ](\d).*(\d{4})/)
    if (match) return { year: parseInt(match[2]), quarter: parseInt(match[1]) }
    return { year: 2025, quarter: 1 }
  }

  // Parse year from yearId
  function parseYear(yearId: string): number {
    const match = yearId.match(/(\d{4})/)
    if (match) return parseInt(match[1])
    // Try to find the year object
    const yearObj = activeClient.years.find((y) => y.id === yearId)
    return yearObj?.year ?? 2025
  }

  // =========== MUTATIONS (optimistic local + async DB write) ===========

  function updateWeeklyValue(keyResultId: string, week: string, value: number) {
    // Optimistic local update
    setClients((prev) =>
      prev.map((client) => ({
        ...client,
        quarters: client.quarters.map((quarter) => ({
          ...quarter,
          goals: quarter.goals.map((goal) => ({
            ...goal,
            keyResults: goal.keyResults.map((kr) =>
              kr.id === keyResultId
                ? { ...kr, weeklyValues: { ...kr.weeklyValues, [week]: value } }
                : kr
            ),
          })),
        })),
      }))
    )
    // Persist
    const weekNum = parseInt(week.replace("W", ""))
    dbUpdateWeeklyValue(keyResultId, weekNum, value)
  }

  function addYear(year: number): string {
    const id = `y-${year}`
    setClients((prev) =>
      prev.map((client) =>
        client.id === activeClientId
          ? { ...client, years: [{ id, year, isActive: true, goals: [] }, ...client.years] }
          : client
      )
    )
    dbAddYear(activeClientId, year)
    return id
  }

  function addQuarter(label: string, year: number): string {
    const match = label.match(/Q(\d)/)
    const q = match ? parseInt(match[1]) : 1
    const id = `${year}-${q}`
    setClients((prev) =>
      prev.map((client) =>
        client.id === activeClientId
          ? { ...client, quarters: [{ id, label, year, isActive: true, goals: [] }, ...client.quarters] }
          : client
      )
    )
    dbAddQuarter(activeClientId, label, year)
    return id
  }

  function patchQuarters(
    quarterId: string,
    fn: (goals: import("./mock-data").QuarterlyGoal[]) => import("./mock-data").QuarterlyGoal[]
  ) {
    setClients((prev) =>
      prev.map((client) =>
        client.id !== activeClientId
          ? client
          : {
              ...client,
              quarters: client.quarters.map((q) =>
                q.id === quarterId ? { ...q, goals: fn(q.goals) } : q
              ),
            }
      )
    )
  }

  async function addQuarterlyGoal(quarterId: string, objective: string, yearlyGoalId: string): Promise<string> {
    const tempId = `qg-${Date.now()}`
    patchQuarters(quarterId, (goals) => [
      ...goals,
      { id: tempId, objective, yearlyGoalId, keyResults: [] },
    ])
    const { year, quarter } = parseQuarterKey(quarterId)
    const realId = await dbAddQuarterlyGoal(activeClientId, year, quarter, yearlyGoalId, objective)
    if (realId) {
      // Replace temp ID with real DB ID in local state
      patchQuarters(quarterId, (goals) =>
        goals.map((g) => g.id === tempId ? { ...g, id: realId } : g)
      )
      return realId
    }
    return tempId
  }

  function updateQuarterlyGoal(quarterId: string, goalId: string, objective: string, yearlyGoalId: string) {
    patchQuarters(quarterId, (goals) =>
      goals.map((g) => g.id === goalId ? { ...g, objective, yearlyGoalId } : g)
    )
    dbUpdateQuarterlyGoal(goalId, objective, yearlyGoalId)
  }

  function deleteQuarterlyGoal(quarterId: string, goalId: string) {
    patchQuarters(quarterId, (goals) => goals.filter((g) => g.id !== goalId))
    dbDeleteQuarterlyGoal(goalId)
  }

  async function addKeyResult(quarterId: string, goalId: string, kr: Omit<KeyResult, "id">) {
    const tempId = `kr-${Date.now()}`
    patchQuarters(quarterId, (goals) =>
      goals.map((g) =>
        g.id === goalId ? { ...g, keyResults: [...g.keyResults, { id: tempId, ...kr }] } : g
      )
    )
    const ownerMemberId = getOwnerMemberId(kr.owner)
    await dbAddKeyResult(goalId, kr, ownerMemberId)
  }

  function updateKeyResult(quarterId: string, goalId: string, krId: string, kr: Partial<KeyResult>) {
    patchQuarters(quarterId, (goals) =>
      goals.map((g) =>
        g.id === goalId
          ? { ...g, keyResults: g.keyResults.map((k) => k.id === krId ? { ...k, ...kr } : k) }
          : g
      )
    )
    const ownerMemberId = kr.owner !== undefined ? getOwnerMemberId(kr.owner) : undefined
    dbUpdateKeyResult(krId, kr, ownerMemberId)
  }

  function deleteKeyResult(quarterId: string, goalId: string, krId: string) {
    patchQuarters(quarterId, (goals) =>
      goals.map((g) =>
        g.id === goalId ? { ...g, keyResults: g.keyResults.filter((k) => k.id !== krId) } : g
      )
    )
    dbDeleteKeyResult(krId)
  }

  function assignKROwner(quarterId: string, goalId: string, krId: string, owner: string | null) {
    patchQuarters(quarterId, (goals) =>
      goals.map((g) =>
        g.id === goalId
          ? { ...g, keyResults: g.keyResults.map((k) => k.id === krId ? { ...k, owner } : k) }
          : g
      )
    )
    dbAssignKROwner(krId, getOwnerMemberId(owner))
  }

  function updateYearlyKRConfidence(yearId: string, goalId: string, krId: string, confidence: Confidence) {
    setClients((prev) =>
      prev.map((client) =>
        client.id !== activeClientId
          ? client
          : {
              ...client,
              years: client.years.map((y) =>
                y.id !== yearId
                  ? y
                  : {
                      ...y,
                      goals: y.goals.map((g) =>
                        g.id !== goalId
                          ? g
                          : {
                              ...g,
                              keyResults: g.keyResults.map((kr) =>
                                kr.id === krId ? { ...kr, confidence } : kr
                              ),
                            }
                      ),
                    }
              ),
            }
      )
    )
    dbUpdateYearlyKRConfidence(krId, confidence)
  }

  function patchYears(
    yearId: string,
    fn: (goals: import("./mock-data").YearlyGoal[]) => import("./mock-data").YearlyGoal[]
  ) {
    setClients((prev) =>
      prev.map((client) =>
        client.id !== activeClientId
          ? client
          : {
              ...client,
              years: client.years.map((y) =>
                y.id === yearId ? { ...y, goals: fn(y.goals) } : y
              ),
            }
      )
    )
  }

  function addYearlyGoal(yearId: string, objective: string, keyResultTitles: string[]) {
    const tempGoalId = `yg-${Date.now()}`
    const keyResults: YearlyKeyResult[] = keyResultTitles
      .filter((t) => t.trim())
      .map((title, i) => ({ id: `ykr-${Date.now()}-${i}`, title, confidence: "not_started" as Confidence }))
    patchYears(yearId, (goals) => [...goals, { id: tempGoalId, objective, keyResults }])

    const year = parseYear(yearId)
    dbAddYearlyGoal(activeClientId, year, objective, keyResultTitles).then(() => {
      refreshClient(activeClientId)
    })
  }

  function updateYearlyGoal(yearId: string, goalId: string, objective: string, keyResults: Omit<YearlyKeyResult, "id">[]) {
    patchYears(yearId, (goals) =>
      goals.map((g) =>
        g.id !== goalId
          ? g
          : {
              ...g,
              objective,
              keyResults: keyResults.map((kr, i) => {
                const existing = g.keyResults[i]
                return { id: existing?.id ?? `ykr-${Date.now()}-${i}`, ...kr }
              }),
            }
      )
    )
    dbUpdateYearlyGoal(goalId, objective, keyResults.map((kr) => ({ title: kr.title, confidence: kr.confidence })) as any)
  }

  function deleteYearlyGoal(yearId: string, goalId: string) {
    patchYears(yearId, (goals) => goals.filter((g) => g.id !== goalId))
    dbDeleteYearlyGoal(goalId)
  }

  function updateClientName(name: string) {
    setClients((prev) =>
      prev.map((c) => c.id === activeClientId ? { ...c, name } : c)
    )
    dbUpdateClientName(activeClientId, name)
  }

  function addMember(name: string, role: string) {
    const tempId = `f-${Date.now()}`
    setClients((prev) =>
      prev.map((c) =>
        c.id === activeClientId
          ? { ...c, members: [...c.members, { id: tempId, name, role, avatar: "" }] }
          : c
      )
    )
    dbAddMember(activeClientId, name, role).then(() => {
      refreshClient(activeClientId)
    })
  }

  function updateMember(memberId: string, name: string, role: string, emails?: string[]) {
    setClients((prev) =>
      prev.map((c) =>
        c.id === activeClientId
          ? {
              ...c,
              members: c.members.map((f) => f.id === memberId ? { ...f, name, role, emails } : f),
              allMembers: c.allMembers.map((m) => m.id === memberId ? { ...m, name, roleTitle: role } : m),
            }
          : c
      )
    )
    dbUpdateMember(memberId, name, role, emails)
  }

  function removeMember(memberId: string) {
    setClients((prev) =>
      prev.map((c) =>
        c.id === activeClientId
          ? {
              ...c,
              members: c.members.filter((f) => f.id !== memberId),
              allMembers: c.allMembers.filter((m) => m.id !== memberId),
            }
          : c
      )
    )
    dbRemoveMember(memberId)
  }

  function removeClientMember(memberId: string) {
    setClients((prev) =>
      prev.map((c) =>
        c.id === activeClientId
          ? {
              ...c,
              members: c.members.filter((f) => f.id !== memberId),
              allMembers: c.allMembers.filter((m) => m.id !== memberId),
            }
          : c
      )
    )
    dbRemoveMember(memberId) // Uses same DB function since it's the same table
  }

  function updateMetricValue(metricId: string, month: number, value: number) {
    setClients((prev) =>
      prev.map((c) =>
        c.id === activeClientId
          ? {
              ...c,
              metrics: c.metrics.map((m) =>
                m.id === metricId ? { ...m, values: { ...m.values, [month]: value } } : m
              ),
            }
          : c
      )
    )
    dbUpdateMetricValue(metricId, month, value)
  }

  function addMetric(metric: Omit<Metric, "id">) {
    const tempId = `m-${Date.now()}`
    setClients((prev) =>
      prev.map((c) =>
        c.id === activeClientId ? { ...c, metrics: [...c.metrics, { id: tempId, ...metric }] } : c
      )
    )
    dbAddMetric(activeClientId, metric).then(() => {
      refreshClient(activeClientId)
    })
  }

  function deleteMetric(metricId: string) {
    setClients((prev) =>
      prev.map((c) =>
        c.id === activeClientId ? { ...c, metrics: c.metrics.filter((m) => m.id !== metricId) } : c
      )
    )
    dbDeleteMetric(metricId)
  }

  async function addClient(name: string) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return

    const newId = await dbAddClient(name, session.user.id)
    if (!newId) return

    const newClient = await fetchClientData(newId)
    if (newClient) {
      setClients((prev) => {
        // Prevent duplicates if addClient is called multiple times
        if (prev.some((c) => c.id === newClient.id)) return prev
        return [...prev, newClient]
      })
      setActiveClientId(newId)
    }
  }

  async function deleteClient(clientId: string) {
    await dbDeleteClient(clientId)
    setClients((prev) => {
      const remaining = prev.filter((c) => c.id !== clientId)
      if (activeClientId === clientId && remaining.length > 0) {
        setActiveClientId(remaining[0].id)
      }
      return remaining
    })
  }

  function archiveTab(type: "year" | "quarter", id: string) {
    setClients((prev) =>
      prev.map((client) =>
        client.id !== activeClientId
          ? client
          : type === "year"
          ? { ...client, years: client.years.map((y) => y.id === id ? { ...y, isActive: false } : y) }
          : { ...client, quarters: client.quarters.map((q) => q.id === id ? { ...q, isActive: false } : q) }
      )
    )
    if (type === "year") {
      const yearObj = activeClient.years.find((y) => y.id === id)
      if (yearObj) dbArchiveYear(activeClientId, yearObj.year, true)
    } else {
      dbArchiveQuarter(activeClientId, id, true)
    }
  }

  function unarchiveTab(type: "year" | "quarter", id: string) {
    setClients((prev) =>
      prev.map((client) =>
        client.id !== activeClientId
          ? client
          : type === "year"
          ? { ...client, years: client.years.map((y) => y.id === id ? { ...y, isActive: true } : y) }
          : { ...client, quarters: client.quarters.map((q) => q.id === id ? { ...q, isActive: true } : q) }
      )
    )
    if (type === "year") {
      const yearObj = activeClient.years.find((y) => y.id === id)
      if (yearObj) dbArchiveYear(activeClientId, yearObj.year, false)
    } else {
      dbArchiveQuarter(activeClientId, id, false)
    }
  }

  // =========== GOAL BOARDS & STANDARD GOALS ===========

  function updateClientFeatures(features: string[]) {
    setClients((prev) =>
      prev.map((c) => c.id !== activeClientId ? c : { ...c, features })
    )
    dbUpdateClientFeatures(activeClientId, features)
  }

  async function addGoalBoard(title: string, boardType: BoardType): Promise<string> {
    const newId = await dbAddGoalBoard(activeClientId, title, boardType)
    if (!newId) throw new Error("Failed to create goal board")
    const newBoard: GoalBoard = { id: newId, title, boardType, isActive: true, goals: [] }
    setClients((prev) =>
      prev.map((c) => c.id !== activeClientId ? c : { ...c, boards: [...(c.boards ?? []), newBoard] })
    )
    return newId
  }

  function updateGoalBoard(boardId: string, title: string) {
    setClients((prev) =>
      prev.map((c) =>
        c.id !== activeClientId ? c : {
          ...c,
          boards: (c.boards ?? []).map((b) => b.id === boardId ? { ...b, title } : b),
        }
      )
    )
    dbUpdateGoalBoard(boardId, title)
  }

  function archiveBoard(boardId: string) {
    setClients((prev) =>
      prev.map((c) =>
        c.id !== activeClientId ? c : {
          ...c,
          boards: (c.boards ?? []).map((b) => b.id === boardId ? { ...b, isActive: false } : b),
        }
      )
    )
    dbArchiveGoalBoard(boardId, true)
  }

  function unarchiveBoard(boardId: string) {
    setClients((prev) =>
      prev.map((c) =>
        c.id !== activeClientId ? c : {
          ...c,
          boards: (c.boards ?? []).map((b) => b.id === boardId ? { ...b, isActive: true } : b),
        }
      )
    )
    dbArchiveGoalBoard(boardId, false)
  }

  function deleteGoalBoard(boardId: string) {
    setClients((prev) =>
      prev.map((c) =>
        c.id !== activeClientId ? c : {
          ...c,
          boards: (c.boards ?? []).filter((b) => b.id !== boardId),
        }
      )
    )
    dbDeleteGoalBoard(boardId)
  }

  async function addStandardGoal(boardId: string, goal: Omit<StandardGoal, "id" | "values">): Promise<string> {
    const memberId = goal.owner
      ? activeClient.allMembers.find((m) => m.name === goal.owner)?.id ?? null
      : null
    const newId = await dbAddStandardGoal(boardId, {
      ...goal,
      ownerMemberId: memberId,
    })
    if (!newId) throw new Error("Failed to create standard goal")
    const newGoal: StandardGoal = { ...goal, id: newId, values: {} }
    setClients((prev) =>
      prev.map((c) =>
        c.id !== activeClientId ? c : {
          ...c,
          boards: (c.boards ?? []).map((b) =>
            b.id !== boardId ? b : { ...b, goals: [...b.goals, newGoal] }
          ),
        }
      )
    )
    return newId
  }

  function updateStandardGoal(boardId: string, goalId: string, updates: Partial<StandardGoal>) {
    setClients((prev) =>
      prev.map((c) =>
        c.id !== activeClientId ? c : {
          ...c,
          boards: (c.boards ?? []).map((b) =>
            b.id !== boardId ? b : {
              ...b,
              goals: b.goals.map((g) => g.id !== goalId ? g : { ...g, ...updates }),
            }
          ),
        }
      )
    )
    // Map owner name to member ID for DB
    const dbUpdates: Record<string, unknown> = {}
    if (updates.title !== undefined) dbUpdates.title = updates.title
    if (updates.description !== undefined) dbUpdates.description = updates.description
    if (updates.targetValue !== undefined) dbUpdates.target_value = updates.targetValue
    if (updates.valueType !== undefined) dbUpdates.value_type = updates.valueType
    if (updates.targetDate !== undefined) dbUpdates.target_date = updates.targetDate
    if (updates.checkInFrequency !== undefined) dbUpdates.check_in_frequency = updates.checkInFrequency
    if (updates.period !== undefined) dbUpdates.period = updates.period
    if (updates.isPriority !== undefined) dbUpdates.is_priority = updates.isPriority
    if (updates.confidence !== undefined) dbUpdates.confidence = updates.confidence
    if (updates.goalType !== undefined) dbUpdates.goal_type = updates.goalType
    if (Object.keys(dbUpdates).length > 0) dbUpdateStandardGoal(goalId, dbUpdates)
  }

  function deleteStandardGoal(boardId: string, goalId: string) {
    setClients((prev) =>
      prev.map((c) =>
        c.id !== activeClientId ? c : {
          ...c,
          boards: (c.boards ?? []).map((b) =>
            b.id !== boardId ? b : { ...b, goals: b.goals.filter((g) => g.id !== goalId) }
          ),
        }
      )
    )
    dbDeleteStandardGoal(goalId)
  }

  function updateStandardGoalValue(boardId: string, goalId: string, periodKey: string, value: number) {
    setClients((prev) =>
      prev.map((c) =>
        c.id !== activeClientId ? c : {
          ...c,
          boards: (c.boards ?? []).map((b) =>
            b.id !== boardId ? b : {
              ...b,
              goals: b.goals.map((g) =>
                g.id !== goalId ? g : { ...g, values: { ...g.values, [periodKey]: value } }
              ),
            }
          ),
        }
      )
    )
    dbUpdateStandardGoalValue(goalId, periodKey, value)
  }

  function assignStandardGoalOwner(boardId: string, goalId: string, owner: string | null) {
    setClients((prev) =>
      prev.map((c) =>
        c.id !== activeClientId ? c : {
          ...c,
          boards: (c.boards ?? []).map((b) =>
            b.id !== boardId ? b : {
              ...b,
              goals: b.goals.map((g) => g.id !== goalId ? g : { ...g, owner }),
            }
          ),
        }
      )
    )
    const memberId = owner
      ? activeClient.allMembers.find((m) => m.name === owner)?.id ?? null
      : null
    dbAssignStandardGoalOwner(goalId, memberId)
  }

  function reorderStandardGoals(boardId: string, fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return
    setClients((prev) =>
      prev.map((c) =>
        c.id !== activeClientId ? c : {
          ...c,
          boards: (c.boards ?? []).map((b) => {
            if (b.id !== boardId) return b
            const goals = [...b.goals]
            const [moved] = goals.splice(fromIndex, 1)
            goals.splice(toIndex, 0, moved)
            return { ...b, goals }
          }),
        }
      )
    )
    const board = (activeClient.boards ?? []).find((b) => b.id === boardId)
    if (board) {
      const goals = [...board.goals]
      const [moved] = goals.splice(fromIndex, 1)
      goals.splice(toIndex, 0, moved)
      dbReorderStandardGoals(goals.map((g) => g.id))
    }
  }

  // ---- Journals ----

  async function addJournal(title: string, description: string | undefined, frequency: string, assignedMemberId: string | null): Promise<string> {
    const tempId = `temp-journal-${Date.now()}`
    const memberName = assignedMemberId
      ? (activeClient.allMembers ?? []).find((m) => m.id === assignedMemberId)?.name ?? null
      : null
    setClients((prev) =>
      prev.map((c) =>
        c.id !== activeClientId ? c : {
          ...c,
          journals: [...(c.journals ?? []), {
            id: tempId,
            title,
            description,
            frequency: frequency as any,
            assignedMember: memberName,
            assignedMemberId,
            archived: false,
            createdAt: new Date().toISOString(),
            entries: {},
          }],
        }
      )
    )
    const realId = await dbAddJournal(activeClientId, { title, description, frequency, assignedMemberId, createdBy: currentUser.id })
    if (realId) {
      setClients((prev) =>
        prev.map((c) =>
          c.id !== activeClientId ? c : {
            ...c,
            journals: (c.journals ?? []).map((j) => j.id === tempId ? { ...j, id: realId } : j),
          }
        )
      )
    }
    return realId ?? tempId
  }

  function updateJournal(journalId: string, updates: { title?: string; description?: string; frequency?: string; assignedMemberId?: string | null; archived?: boolean }) {
    const memberName = updates.assignedMemberId !== undefined
      ? (updates.assignedMemberId ? (activeClient.allMembers ?? []).find((m) => m.id === updates.assignedMemberId)?.name ?? null : null)
      : undefined
    setClients((prev) =>
      prev.map((c) =>
        c.id !== activeClientId ? c : {
          ...c,
          journals: (c.journals ?? []).map((j) =>
            j.id !== journalId ? j : {
              ...j,
              ...(updates.title !== undefined && { title: updates.title }),
              ...(updates.description !== undefined && { description: updates.description }),
              ...(updates.frequency !== undefined && { frequency: updates.frequency as any }),
              ...(updates.assignedMemberId !== undefined && { assignedMemberId: updates.assignedMemberId, assignedMember: memberName }),
              ...(updates.archived !== undefined && { archived: updates.archived }),
            }
          ),
        }
      )
    )
    dbUpdateJournal(journalId, updates)
  }

  function deleteJournal(journalId: string) {
    setClients((prev) =>
      prev.map((c) =>
        c.id !== activeClientId ? c : {
          ...c,
          journals: (c.journals ?? []).filter((j) => j.id !== journalId),
        }
      )
    )
    dbDeleteJournal(journalId)
  }

  function archiveJournal(journalId: string) {
    updateJournal(journalId, { archived: true })
  }

  function upsertJournalEntry(journalId: string, periodKey: string, content: string) {
    setClients((prev) =>
      prev.map((c) =>
        c.id !== activeClientId ? c : {
          ...c,
          journals: (c.journals ?? []).map((j) =>
            j.id !== journalId ? j : {
              ...j,
              entries: {
                ...j.entries,
                [periodKey]: {
                  id: j.entries[periodKey]?.id ?? `temp-je-${Date.now()}`,
                  journalId,
                  periodKey,
                  authorId: currentUser.id,
                  authorName: currentUser.name,
                  content,
                  updatedAt: new Date().toISOString(),
                },
              },
            }
          ),
        }
      )
    )
    dbUpsertJournalEntry(journalId, periodKey, currentUser.id, content)
  }

  async function inviteUser(email: string, role: "member" | "coach", memberId?: string): Promise<Invitation | null> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return null

    return await dbInviteUser(activeClientId, email, role, session.user.id, undefined, memberId)
  }

  async function getInvitations(): Promise<Invitation[]> {
    return await dbGetInvitations(activeClientId)
  }

  async function cancelInvitation(invitationId: string): Promise<void> {
    await dbCancelInvitation(invitationId)
  }

  async function acceptInvitation(token: string): Promise<{ success: boolean; clientId?: string; error?: string }> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return { success: false, error: "Not authenticated" }

    return await dbAcceptInvitation(token, session.user.id)
  }

  async function updateProfile(name: string) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return

    await supabase
      .from("profiles")
      .update({ full_name: name })
      .eq("id", session.user.id)

    const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    setCurrentUser((prev) => ({ ...prev, name, avatar: initials }))
  }

  // =========== REORDERING FUNCTIONS ===========

  function reorderYearlyGoals(yearId: string, fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return
    setClients((prev) =>
      prev.map((client) =>
        client.id !== activeClientId
          ? client
          : {
              ...client,
              years: client.years.map((y) => {
                if (y.id !== yearId) return y
                const goals = [...y.goals]
                const [moved] = goals.splice(fromIndex, 1)
                goals.splice(toIndex, 0, moved)
                return { ...y, goals }
              }),
            }
      )
    )
    // Persist to DB
    const year = activeClient.years.find((y) => y.id === yearId)
    if (year) {
      const goals = [...year.goals]
      const [moved] = goals.splice(fromIndex, 1)
      goals.splice(toIndex, 0, moved)
      dbReorderYearlyGoals(goals.map((g) => g.id))
    }
  }

  function reorderYearlyKeyResults(yearId: string, goalId: string, fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return
    setClients((prev) =>
      prev.map((client) =>
        client.id !== activeClientId
          ? client
          : {
              ...client,
              years: client.years.map((y) => {
                if (y.id !== yearId) return y
                return {
                  ...y,
                  goals: y.goals.map((g) => {
                    if (g.id !== goalId) return g
                    const keyResults = [...g.keyResults]
                    const [moved] = keyResults.splice(fromIndex, 1)
                    keyResults.splice(toIndex, 0, moved)
                    return { ...g, keyResults }
                  }),
                }
              }),
            }
      )
    )
    // Persist to DB
    const year = activeClient.years.find((y) => y.id === yearId)
    const goal = year?.goals.find((g) => g.id === goalId)
    if (goal) {
      const keyResults = [...goal.keyResults]
      const [moved] = keyResults.splice(fromIndex, 1)
      keyResults.splice(toIndex, 0, moved)
      dbReorderYearlyKeyResults(keyResults.map((kr) => kr.id))
    }
  }

  function reorderQuarterlyGoals(quarterId: string, fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return
    patchQuarters(quarterId, (goals) => {
      const copy = [...goals]
      const [moved] = copy.splice(fromIndex, 1)
      copy.splice(toIndex, 0, moved)
      return copy
    })
    // Persist to DB
    const quarter = activeClient.quarters.find((q) => q.id === quarterId)
    if (quarter) {
      const goals = [...quarter.goals]
      const [moved] = goals.splice(fromIndex, 1)
      goals.splice(toIndex, 0, moved)
      dbReorderQuarterlyGoals(goals.map((g) => g.id))
    }
  }

  function reorderQuarterlyKeyResults(quarterId: string, goalId: string, fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return
    patchQuarters(quarterId, (goals) =>
      goals.map((g) => {
        if (g.id !== goalId) return g
        const keyResults = [...g.keyResults]
        const [moved] = keyResults.splice(fromIndex, 1)
        keyResults.splice(toIndex, 0, moved)
        return { ...g, keyResults }
      })
    )
    // Persist to DB
    const quarter = activeClient.quarters.find((q) => q.id === quarterId)
    const goal = quarter?.goals.find((g) => g.id === goalId)
    if (goal) {
      const keyResults = [...goal.keyResults]
      const [moved] = keyResults.splice(fromIndex, 1)
      keyResults.splice(toIndex, 0, moved)
      dbReorderQuarterlyKeyResults(keyResults.map((kr) => kr.id))
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-lg border border-destructive/30 bg-destructive/5 p-6">
          <h2 className="text-lg font-semibold text-foreground mb-2">Failed to load data</h2>
          <p className="text-sm text-muted-foreground mb-4">{loadError}</p>
          <button onClick={loadData} className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90">Retry</button>
        </div>
      </div>
    )
  }

  return (
    <AppContext.Provider
      value={{
        isLoading,
        coach: defaultCoach,
        currentUser,
        clients,
        activeClientId,
        activeClient,
        setActiveClientId,
        setClients,
        updateWeeklyValue,
        addYear,
        addQuarter,
        archiveTab,
        unarchiveTab,
        addQuarterlyGoal,
        updateQuarterlyGoal,
        deleteQuarterlyGoal,
        addKeyResult,
        updateKeyResult,
        deleteKeyResult,
        updateYearlyKRConfidence,
        assignKROwner,
        addYearlyGoal,
        updateYearlyGoal,
        deleteYearlyGoal,
        updateClientName,
        addMember,
        updateMember,
        removeMember,
        removeClientMember,
        updateMetricValue,
        addMetric,
        deleteMetric,
        addClient,
        deleteClient,
        inviteUser,
        getInvitations,
        cancelInvitation,
        acceptInvitation,
        updateProfile,
        refreshData: loadData,
        reorderYearlyGoals,
        reorderYearlyKeyResults,
        reorderQuarterlyGoals,
        reorderQuarterlyKeyResults,
        updateClientFeatures,
        addGoalBoard,
        updateGoalBoard,
        archiveBoard,
        unarchiveBoard,
        deleteGoalBoard,
        addStandardGoal,
        updateStandardGoal,
        deleteStandardGoal,
        updateStandardGoalValue,
        assignStandardGoalOwner,
        reorderStandardGoals,
        addJournal,
        updateJournal,
        deleteJournal,
        archiveJournal,
        upsertJournalEntry,
        pendingJournalNav,
        setPendingJournalNav,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used within AppProvider")
  return ctx
}
