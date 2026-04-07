"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import { fetchUserCompanies, dbUpdateWeeklyValue, dbAddYearlyGoal, dbUpdateYearlyGoal, dbDeleteYearlyGoal, dbUpdateYearlyKRConfidence, dbAddQuarterlyGoal, dbUpdateQuarterlyGoal, dbDeleteQuarterlyGoal, dbAddKeyResult, dbUpdateKeyResult, dbDeleteKeyResult, dbAssignKROwner, dbUpdateCompanyName, dbAddFounder, dbUpdateFounder, dbRemoveFounder, dbUpdateMetricValue, dbAddMetric, dbDeleteMetric, dbArchiveQuarter, dbArchiveYear, dbAddYear, dbAddQuarter, fetchCompanyData, dbAddCompany, dbDeleteCompany, dbInviteUser, dbGetInvitations, dbCancelInvitation, dbAcceptInvitation, dbGetUnconnectedFounders, dbReorderYearlyGoals, dbReorderYearlyKeyResults, dbReorderQuarterlyGoals, dbReorderQuarterlyKeyResults, dbSetCompanyCustomGoalsEnabled, dbAddCustomGoalBoard, dbUpdateCustomGoalBoard, dbDeleteCustomGoalBoard, dbAddCustomGoal, dbUpdateCustomGoal, dbDeleteCustomGoal, dbUpsertCustomGoalCheckin, dbReorderCustomGoals, fetchCustomGoalBoards, dbAddCustomGoalGroup, dbUpdateCustomGoalGroup, dbDeleteCustomGoalGroup, type Invitation, type UnconnectedFounder } from "./supabase-data"
import type { Company, Coach, CurrentUser, KeyResult, YearlyKeyResult, Confidence, Metric, CustomGoalBoard, CustomGoal, CustomGoalType, CustomGoalBoardType, CustomGoalGroup } from "./mock-data"

interface AppState {
  isLoading: boolean
  coach: Coach
  currentUser: CurrentUser
  companies: Company[]
  activeCompanyId: string
  activeCompany: Company
  setActiveCompanyId: (id: string) => void
  setCompanies: React.Dispatch<React.SetStateAction<Company[]>>
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
  updateCompanyName: (name: string) => void
  addFounder: (name: string, role: string) => void
  updateFounder: (founderId: string, name: string, role: string, emails?: string[]) => void
  removeFounder: (founderId: string) => void
  removeMember: (memberId: string) => void
  updateMetricValue: (metricId: string, month: number, value: number) => void
  addMetric: (metric: Omit<Metric, "id">) => void
  deleteMetric: (metricId: string) => void
  addCompany: (name: string) => Promise<void>
  deleteCompany: (companyId: string) => Promise<void>
  inviteUser: (email: string, role: "founder" | "coach", memberId?: string) => Promise<Invitation | null>
  getInvitations: () => Promise<Invitation[]>
  cancelInvitation: (invitationId: string) => Promise<void>
  acceptInvitation: (token: string) => Promise<{ success: boolean; companyId?: string; error?: string }>
  updateProfile: (name: string) => Promise<void>
  refreshData: () => Promise<void>
  reorderYearlyGoals: (yearId: string, fromIndex: number, toIndex: number) => void
  reorderYearlyKeyResults: (yearId: string, goalId: string, fromIndex: number, toIndex: number) => void
  reorderQuarterlyGoals: (quarterId: string, fromIndex: number, toIndex: number) => void
  reorderQuarterlyKeyResults: (quarterId: string, goalId: string, fromIndex: number, toIndex: number) => void
  // Custom Goals
  setCustomGoalsEnabled: (enabled: boolean) => Promise<void>
  addCustomGoalBoard: (name: string, boardType: CustomGoalBoardType, startDate: string, endDate: string) => Promise<string | null>
  updateCustomGoalBoard: (boardId: string, updates: { name?: string; isActive?: boolean }) => void
  deleteCustomGoalBoard: (boardId: string) => void
  addCustomGoal: (boardId: string, title: string, type: CustomGoalType, target: number | null, description: string | null, groupId?: string | null, unit?: string | null) => Promise<string | null>
  updateCustomGoal: (boardId: string, goalId: string, updates: { title?: string; type?: CustomGoalType; target?: number | null; description?: string | null; groupId?: string | null; unit?: string | null }) => void
  deleteCustomGoal: (boardId: string, goalId: string) => void
  updateCustomGoalCheckin: (boardId: string, goalId: string, checkinDate: string, value: number | null, textValue: string | null) => void
  refreshCustomGoalBoards: () => Promise<void>
  // Custom Goal Groups
  addCustomGoalGroup: (boardId: string, name: string) => Promise<string | null>
  updateCustomGoalGroup: (boardId: string, groupId: string, updates: { name?: string; isCollapsed?: boolean }) => void
  deleteCustomGoalGroup: (boardId: string, groupId: string) => void
}

const AppContext = createContext<AppState | null>(null)

const emptyCompany: Company = {
  id: "",
  name: "",
  founders: [],
  members: [],
  years: [],
  quarters: [],
  metrics: [],
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
  role: "founder",
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [activeCompanyId, setActiveCompanyId] = useState("")
  const [currentUser, setCurrentUser] = useState<CurrentUser>(defaultUser)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const activeCompany = companies.find((c) => c.id === activeCompanyId) ?? companies[0] ?? emptyCompany

  // Clear all user data (used on logout or session change)
  const clearUserData = useCallback(() => {
    setCompanies([])
    setActiveCompanyId("")
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
        .select("full_name")
        .eq("id", session.user.id)
        .single()

      // Determine user role: check if they own any company OR are a coach member in any company
      const { data: ownedCompanies } = await supabase
        .from("companies")
        .select("id")
        .eq("coach_id", session.user.id)
        .limit(1)

      // Also check if the user is a coach member in any company
      const { data: coachMemberships } = await supabase
        .from("company_members")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("role", "coach")
        .limit(1)

      const userRole = (ownedCompanies && ownedCompanies.length > 0) || (coachMemberships && coachMemberships.length > 0) ? "coach" : "founder"
      const userName = profile?.full_name || session.user.email?.split("@")[0] || "User"
      const initials = userName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)

      setCurrentUser({
        id: session.user.id,
        name: userName,
        email: session.user.email || "",
        avatar: initials,
        role: userRole,
      })

      const data = await fetchUserCompanies(session.user.id)
      setCompanies(data)
      if (data.length > 0) {
        // Preserve current active company if it still exists, otherwise default to first
        setActiveCompanyId((current) => {
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

  // Helper to refresh a single company after mutations.
  // Merges DB data with optimistic state to avoid losing locally-added items
  // (e.g. a quarter tab added while a yearly goal save is in flight).
  async function refreshCompany(companyId: string) {
    const updated = await fetchCompanyData(companyId)
    if (updated) {
      setCompanies((prev) => prev.map((c) => {
        if (c.id !== companyId) return c
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

  // Helper to get owner member ID from name (checks all members, not just founders)
  function getOwnerMemberId(ownerName: string | null): string | null {
    if (!ownerName) return null
    const member = activeCompany.members?.find((m) => m.name === ownerName)
      ?? activeCompany.founders.find((f) => f.name === ownerName)
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
    const yearObj = activeCompany.years.find((y) => y.id === yearId)
    return yearObj?.year ?? 2025
  }

  // =========== MUTATIONS (optimistic local + async DB write) ===========

  function updateWeeklyValue(keyResultId: string, week: string, value: number) {
    // Optimistic local update
    setCompanies((prev) =>
      prev.map((company) => ({
        ...company,
        quarters: company.quarters.map((quarter) => ({
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
    setCompanies((prev) =>
      prev.map((company) =>
        company.id === activeCompanyId
          ? { ...company, years: [{ id, year, isActive: true, goals: [] }, ...company.years] }
          : company
      )
    )
    dbAddYear(activeCompanyId, year)
    return id
  }

  function addQuarter(label: string, year: number): string {
    const match = label.match(/Q(\d)/)
    const q = match ? parseInt(match[1]) : 1
    const id = `${year}-${q}`
    setCompanies((prev) =>
      prev.map((company) =>
        company.id === activeCompanyId
          ? { ...company, quarters: [{ id, label, year, isActive: true, goals: [] }, ...company.quarters] }
          : company
      )
    )
    dbAddQuarter(activeCompanyId, label, year)
    return id
  }

  function patchQuarters(
    quarterId: string,
    fn: (goals: import("./mock-data").QuarterlyGoal[]) => import("./mock-data").QuarterlyGoal[]
  ) {
    setCompanies((prev) =>
      prev.map((company) =>
        company.id !== activeCompanyId
          ? company
          : {
              ...company,
              quarters: company.quarters.map((q) =>
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
    const realId = await dbAddQuarterlyGoal(activeCompanyId, year, quarter, yearlyGoalId, objective)
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
    setCompanies((prev) =>
      prev.map((company) =>
        company.id !== activeCompanyId
          ? company
          : {
              ...company,
              years: company.years.map((y) =>
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
    setCompanies((prev) =>
      prev.map((company) =>
        company.id !== activeCompanyId
          ? company
          : {
              ...company,
              years: company.years.map((y) =>
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
    dbAddYearlyGoal(activeCompanyId, year, objective, keyResultTitles).then(() => {
      refreshCompany(activeCompanyId)
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

  function updateCompanyName(name: string) {
    setCompanies((prev) =>
      prev.map((c) => c.id === activeCompanyId ? { ...c, name } : c)
    )
    dbUpdateCompanyName(activeCompanyId, name)
  }

  function addFounder(name: string, role: string) {
    const tempId = `f-${Date.now()}`
    setCompanies((prev) =>
      prev.map((c) =>
        c.id === activeCompanyId
          ? { ...c, founders: [...c.founders, { id: tempId, name, role, avatar: "" }] }
          : c
      )
    )
    dbAddFounder(activeCompanyId, name, role).then(() => {
      refreshCompany(activeCompanyId)
    })
  }

  function updateFounder(founderId: string, name: string, role: string, emails?: string[]) {
    setCompanies((prev) =>
      prev.map((c) =>
        c.id === activeCompanyId
          ? {
              ...c,
              founders: c.founders.map((f) => f.id === founderId ? { ...f, name, role, emails } : f),
              members: c.members.map((m) => m.id === founderId ? { ...m, name, roleTitle: role } : m),
            }
          : c
      )
    )
    dbUpdateFounder(founderId, name, role, emails)
  }

  function removeFounder(founderId: string) {
    setCompanies((prev) =>
      prev.map((c) =>
        c.id === activeCompanyId
          ? { 
              ...c, 
              founders: c.founders.filter((f) => f.id !== founderId),
              members: c.members.filter((m) => m.id !== founderId),
            }
          : c
      )
    )
    dbRemoveFounder(founderId)
  }

  function removeMember(memberId: string) {
    setCompanies((prev) =>
      prev.map((c) =>
        c.id === activeCompanyId
          ? { 
              ...c, 
              founders: c.founders.filter((f) => f.id !== memberId),
              members: c.members.filter((m) => m.id !== memberId),
            }
          : c
      )
    )
    dbRemoveFounder(memberId) // Uses same DB function since it's the same table
  }

  function updateMetricValue(metricId: string, month: number, value: number) {
    setCompanies((prev) =>
      prev.map((c) =>
        c.id === activeCompanyId
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
    setCompanies((prev) =>
      prev.map((c) =>
        c.id === activeCompanyId ? { ...c, metrics: [...c.metrics, { id: tempId, ...metric }] } : c
      )
    )
    dbAddMetric(activeCompanyId, metric).then(() => {
      refreshCompany(activeCompanyId)
    })
  }

  function deleteMetric(metricId: string) {
    setCompanies((prev) =>
      prev.map((c) =>
        c.id === activeCompanyId ? { ...c, metrics: c.metrics.filter((m) => m.id !== metricId) } : c
      )
    )
    dbDeleteMetric(metricId)
  }

  async function addCompany(name: string) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return

    const newId = await dbAddCompany(name, session.user.id)
    if (!newId) return

    const newCompany = await fetchCompanyData(newId)
    if (newCompany) {
      setCompanies((prev) => {
        // Prevent duplicates if addCompany is called multiple times
        if (prev.some((c) => c.id === newCompany.id)) return prev
        return [...prev, newCompany]
      })
      setActiveCompanyId(newId)
    }
  }

  async function deleteCompany(companyId: string) {
    await dbDeleteCompany(companyId)
    setCompanies((prev) => {
      const remaining = prev.filter((c) => c.id !== companyId)
      if (activeCompanyId === companyId && remaining.length > 0) {
        setActiveCompanyId(remaining[0].id)
      }
      return remaining
    })
  }

  function archiveTab(type: "year" | "quarter", id: string) {
    setCompanies((prev) =>
      prev.map((company) =>
        company.id !== activeCompanyId
          ? company
          : type === "year"
          ? { ...company, years: company.years.map((y) => y.id === id ? { ...y, isActive: false } : y) }
          : { ...company, quarters: company.quarters.map((q) => q.id === id ? { ...q, isActive: false } : q) }
      )
    )
    if (type === "year") {
      const yearObj = activeCompany.years.find((y) => y.id === id)
      if (yearObj) dbArchiveYear(activeCompanyId, yearObj.year, true)
    } else {
      dbArchiveQuarter(activeCompanyId, id, true)
    }
  }

  function unarchiveTab(type: "year" | "quarter", id: string) {
    setCompanies((prev) =>
      prev.map((company) =>
        company.id !== activeCompanyId
          ? company
          : type === "year"
          ? { ...company, years: company.years.map((y) => y.id === id ? { ...y, isActive: true } : y) }
          : { ...company, quarters: company.quarters.map((q) => q.id === id ? { ...q, isActive: true } : q) }
      )
    )
    if (type === "year") {
      const yearObj = activeCompany.years.find((y) => y.id === id)
      if (yearObj) dbArchiveYear(activeCompanyId, yearObj.year, false)
    } else {
      dbArchiveQuarter(activeCompanyId, id, false)
    }
  }

  async function inviteUser(email: string, role: "founder" | "coach", memberId?: string): Promise<Invitation | null> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return null

    return await dbInviteUser(activeCompanyId, email, role, session.user.id, undefined, memberId)
  }

  async function getInvitations(): Promise<Invitation[]> {
    return await dbGetInvitations(activeCompanyId)
  }

  async function cancelInvitation(invitationId: string): Promise<void> {
    await dbCancelInvitation(invitationId)
  }

  async function acceptInvitation(token: string): Promise<{ success: boolean; companyId?: string; error?: string }> {
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
    setCompanies((prev) =>
      prev.map((company) =>
        company.id !== activeCompanyId
          ? company
          : {
              ...company,
              years: company.years.map((y) => {
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
    const year = activeCompany.years.find((y) => y.id === yearId)
    if (year) {
      const goals = [...year.goals]
      const [moved] = goals.splice(fromIndex, 1)
      goals.splice(toIndex, 0, moved)
      dbReorderYearlyGoals(goals.map((g) => g.id))
    }
  }

  function reorderYearlyKeyResults(yearId: string, goalId: string, fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return
    setCompanies((prev) =>
      prev.map((company) =>
        company.id !== activeCompanyId
          ? company
          : {
              ...company,
              years: company.years.map((y) => {
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
    const year = activeCompany.years.find((y) => y.id === yearId)
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
    const quarter = activeCompany.quarters.find((q) => q.id === quarterId)
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
    const quarter = activeCompany.quarters.find((q) => q.id === quarterId)
    const goal = quarter?.goals.find((g) => g.id === goalId)
    if (goal) {
      const keyResults = [...goal.keyResults]
      const [moved] = keyResults.splice(fromIndex, 1)
      keyResults.splice(toIndex, 0, moved)
      dbReorderQuarterlyKeyResults(keyResults.map((kr) => kr.id))
    }
  }

  // =========== CUSTOM GOALS FUNCTIONS ===========

  function patchCustomGoalBoards(fn: (boards: CustomGoalBoard[]) => CustomGoalBoard[]) {
    setCompanies((prev) =>
      prev.map((company) =>
        company.id !== activeCompanyId
          ? company
          : { ...company, customGoalBoards: fn(company.customGoalBoards ?? []) }
      )
    )
  }

  async function setCustomGoalsEnabled(enabled: boolean) {
    setCompanies((prev) =>
      prev.map((c) => c.id === activeCompanyId ? { ...c, customGoalsEnabled: enabled } : c)
    )
    await dbSetCompanyCustomGoalsEnabled(activeCompanyId, enabled)
    if (enabled) {
      // Fetch boards when enabling
      const boards = await fetchCustomGoalBoards(activeCompanyId)
      setCompanies((prev) =>
        prev.map((c) => c.id === activeCompanyId ? { ...c, customGoalBoards: boards } : c)
      )
    }
  }

async function addCustomGoalBoard(
    name: string,
    boardType: CustomGoalBoardType,
    startDate: string,
    endDate: string
  ): Promise<string | null> {
    const tempId = `cgb-${Date.now()}`
    const tempBoard: CustomGoalBoard = {
      id: tempId,
      companyId: activeCompanyId,
      name,
      boardType,
      startDate,
      endDate,
      isActive: true,
      goals: [],
      groups: [],
      createdAt: new Date(),
    }
    patchCustomGoalBoards((boards) => [tempBoard, ...boards])

    const realId = await dbAddCustomGoalBoard(activeCompanyId, name, boardType, startDate, endDate)
    if (realId) {
      patchCustomGoalBoards((boards) =>
        boards.map((b) => b.id === tempId ? { ...b, id: realId } : b)
      )
      return realId
    }
    return tempId
  }

  function updateCustomGoalBoard(boardId: string, updates: { name?: string; isActive?: boolean }) {
    patchCustomGoalBoards((boards) =>
      boards.map((b) => b.id === boardId ? { ...b, ...updates } : b)
    )
    dbUpdateCustomGoalBoard(boardId, updates)
  }

  function deleteCustomGoalBoard(boardId: string) {
    patchCustomGoalBoards((boards) => boards.filter((b) => b.id !== boardId))
    dbDeleteCustomGoalBoard(boardId)
  }

async function addCustomGoal(
    boardId: string,
    title: string,
    type: CustomGoalType,
    target: number | null,
    description: string | null,
    groupId: string | null = null,
    unit: string | null = null
  ): Promise<string | null> {
    const tempId = `cg-${Date.now()}`
    const tempGoal: CustomGoal = {
      id: tempId,
      boardId,
      groupId,
      title,
      description,
      type,
      target,
      currentValue: null,
      unit,
      position: 0,
      ownerId: null,
      checkins: {},
    }
    patchCustomGoalBoards((boards) =>
      boards.map((b) =>
        b.id === boardId ? { ...b, goals: [...b.goals, tempGoal] } : b
      )
    )

    const realId = await dbAddCustomGoal(boardId, title, type, target, description, groupId, unit)
    if (realId) {
      patchCustomGoalBoards((boards) =>
        boards.map((b) =>
          b.id === boardId
            ? { ...b, goals: b.goals.map((g) => g.id === tempId ? { ...g, id: realId } : g) }
            : b
        )
      )
      return realId
    }
    return tempId
  }

function updateCustomGoal(
    boardId: string,
    goalId: string,
    updates: { title?: string; type?: CustomGoalType; target?: number | null; description?: string | null; groupId?: string | null; unit?: string | null }
  ) {
    patchCustomGoalBoards((boards) =>
      boards.map((b) =>
        b.id === boardId
          ? { ...b, goals: b.goals.map((g) => g.id === goalId ? { ...g, ...updates } : g) }
          : b
      )
    )
    dbUpdateCustomGoal(goalId, updates)
  }

  function deleteCustomGoal(boardId: string, goalId: string) {
    patchCustomGoalBoards((boards) =>
      boards.map((b) =>
        b.id === boardId ? { ...b, goals: b.goals.filter((g) => g.id !== goalId) } : b
      )
    )
    dbDeleteCustomGoal(goalId)
  }

function updateCustomGoalCheckin(
    boardId: string,
    goalId: string,
    checkinDate: string,
    value: number | null,
    textValue: string | null
  ) {
    patchCustomGoalBoards((boards) =>
      boards.map((b) =>
        b.id === boardId
          ? {
              ...b,
              goals: b.goals.map((g) => {
                if (g.id !== goalId) return g
                const newCheckins = { ...g.checkins, [checkinDate]: { value, textValue } }
                // Calculate new current_value (sum of all numeric values for number/currency/percentage, latest for boolean)
                let newCurrentValue: number | null = null
                if (g.type === "boolean") {
                  newCurrentValue = value
                } else if (g.type !== "text") {
                  newCurrentValue = Object.values(newCheckins).reduce((sum, ci) => sum + (ci.value ?? 0), 0)
                }
                return { ...g, checkins: newCheckins, currentValue: newCurrentValue }
              }),
            }
          : b
      )
    )
dbUpsertCustomGoalCheckin(goalId, checkinDate, value, textValue)
  }

  async function refreshCustomGoalBoards() {
    const boards = await fetchCustomGoalBoards(activeCompanyId)
    setCompanies((prev) =>
      prev.map((c) => c.id === activeCompanyId ? { ...c, customGoalBoards: boards } : c)
    )
  }

  // =========== CUSTOM GOAL GROUP FUNCTIONS ===========

  async function addCustomGoalGroup(boardId: string, name: string): Promise<string | null> {
    const tempId = `cgg-${Date.now()}`
    const tempGroup: CustomGoalGroup = {
      id: tempId,
      boardId,
      name,
      position: 0,
      isCollapsed: false,
    }
    patchCustomGoalBoards((boards) =>
      boards.map((b) =>
        b.id === boardId ? { ...b, groups: [...b.groups, tempGroup] } : b
      )
    )

    const realId = await dbAddCustomGoalGroup(boardId, name)
    if (realId) {
      patchCustomGoalBoards((boards) =>
        boards.map((b) =>
          b.id === boardId
            ? { ...b, groups: b.groups.map((g) => g.id === tempId ? { ...g, id: realId } : g) }
            : b
        )
      )
      return realId
    }
    return tempId
  }

  function updateCustomGoalGroup(
    boardId: string,
    groupId: string,
    updates: { name?: string; isCollapsed?: boolean }
  ) {
    patchCustomGoalBoards((boards) =>
      boards.map((b) =>
        b.id === boardId
          ? { ...b, groups: b.groups.map((g) => g.id === groupId ? { ...g, ...updates } : g) }
          : b
      )
    )
    dbUpdateCustomGoalGroup(groupId, updates)
  }

  function deleteCustomGoalGroup(boardId: string, groupId: string) {
    // Move goals from this group to ungrouped
    patchCustomGoalBoards((boards) =>
      boards.map((b) =>
        b.id === boardId
          ? {
              ...b,
              groups: b.groups.filter((g) => g.id !== groupId),
              goals: b.goals.map((g) => g.groupId === groupId ? { ...g, groupId: null } : g),
            }
          : b
      )
    )
    dbDeleteCustomGoalGroup(groupId)
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
        companies,
        activeCompanyId,
        activeCompany,
        setActiveCompanyId,
        setCompanies,
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
        updateCompanyName,
        addFounder,
        updateFounder,
        removeFounder,
        removeMember,
        updateMetricValue,
        addMetric,
        deleteMetric,
        addCompany,
        deleteCompany,
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
        // Custom Goals
        setCustomGoalsEnabled,
        addCustomGoalBoard,
        updateCustomGoalBoard,
        deleteCustomGoalBoard,
        addCustomGoal,
        updateCustomGoal,
        deleteCustomGoal,
        updateCustomGoalCheckin,
refreshCustomGoalBoards,
        // Custom Goal Groups
        addCustomGoalGroup,
        updateCustomGoalGroup,
        deleteCustomGoalGroup,
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
