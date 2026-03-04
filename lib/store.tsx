"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import { fetchUserCompanies, dbUpdateWeeklyValue, dbAddYearlyGoal, dbUpdateYearlyGoal, dbDeleteYearlyGoal, dbUpdateYearlyKRConfidence, dbAddQuarterlyGoal, dbUpdateQuarterlyGoal, dbDeleteQuarterlyGoal, dbAddKeyResult, dbUpdateKeyResult, dbDeleteKeyResult, dbAssignKROwner, dbUpdateCompanyName, dbAddFounder, dbUpdateFounder, dbRemoveFounder, dbUpdateMetricValue, dbAddMetric, dbDeleteMetric, dbArchiveQuarter, dbArchiveYear, dbAddYear, dbAddQuarter, fetchCompanyData, dbAddCompany, dbDeleteCompany, dbInviteUser, dbGetInvitations, dbCancelInvitation, dbAcceptInvitation, dbGetUnconnectedFounders, type Invitation, type UnconnectedFounder } from "./supabase-data"
import type { Company, Coach, CurrentUser, KeyResult, YearlyKeyResult, Confidence, Metric } from "./mock-data"

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
  updateFounder: (founderId: string, name: string, role: string) => void
  removeFounder: (founderId: string) => void
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

  // Load data from Supabase on mount
  const loadData = useCallback(async () => {
    try {
      setLoadError(null)
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setLoadError("No active session found. Please log in.")
        return
      }

      // Load user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", session.user.id)
        .single()

      // Determine user role: check if they own any company (coach) or are a member
      const { data: ownedCompanies } = await supabase
        .from("companies")
        .select("id")
        .eq("coach_id", session.user.id)
        .limit(1)

      const userRole = (ownedCompanies && ownedCompanies.length > 0) ? "coach" : "founder"
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
        setActiveCompanyId(data[0].id)
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
  }, [loadData])

  // Helper to refresh a single company after mutations
  async function refreshCompany(companyId: string) {
    const updated = await fetchCompanyData(companyId)
    if (updated) {
      setCompanies((prev) => prev.map((c) => c.id === companyId ? updated : c))
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

  function updateFounder(founderId: string, name: string, role: string) {
    setCompanies((prev) =>
      prev.map((c) =>
        c.id === activeCompanyId
          ? {
              ...c,
              founders: c.founders.map((f) => f.id === founderId ? { ...f, name, role } : f),
              members: c.members.map((m) => m.id === founderId ? { ...m, name, roleTitle: role } : m),
            }
          : c
      )
    )
    dbUpdateFounder(founderId, name, role)
  }

  function removeFounder(founderId: string) {
    setCompanies((prev) =>
      prev.map((c) =>
        c.id === activeCompanyId
          ? { ...c, founders: c.founders.filter((f) => f.id !== founderId) }
          : c
      )
    )
    dbRemoveFounder(founderId)
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
