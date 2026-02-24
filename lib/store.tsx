"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import { mockCompanies, mockCoach, type Company, type Coach } from "./mock-data"

interface AppState {
  coach: Coach
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
  addQuarterlyGoal: (quarterId: string, objective: string, yearlyGoalId: string) => string
  updateQuarterlyGoal: (quarterId: string, goalId: string, objective: string, yearlyGoalId: string) => void
  deleteQuarterlyGoal: (quarterId: string, goalId: string) => void
  addKeyResult: (quarterId: string, goalId: string, kr: Omit<import("./mock-data").KeyResult, "id">) => void
  updateKeyResult: (quarterId: string, goalId: string, krId: string, kr: Partial<import("./mock-data").KeyResult>) => void
  deleteKeyResult: (quarterId: string, goalId: string, krId: string) => void
  updateYearlyKRConfidence: (yearId: string, goalId: string, krId: string, confidence: import("./mock-data").Confidence) => void
  assignKROwner: (quarterId: string, goalId: string, krId: string, owner: string | null) => void
}

const AppContext = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>(mockCompanies)
  const [activeCompanyId, setActiveCompanyId] = useState(mockCompanies[0].id)

  const activeCompany = companies.find((c) => c.id === activeCompanyId) ?? companies[0]

  function updateWeeklyValue(keyResultId: string, week: string, value: number) {
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
  }

  function addYear(year: number): string {
    const id = `y-${Date.now()}`
    setCompanies((prev) =>
      prev.map((company) =>
        company.id === activeCompanyId
          ? {
              ...company,
              years: [
                { id, year, isActive: true, goals: [] },
                ...company.years,
              ],
            }
          : company
      )
    )
    return id
  }

  function addQuarter(label: string, year: number): string {
    const id = `q-${Date.now()}`
    setCompanies((prev) =>
      prev.map((company) =>
        company.id === activeCompanyId
          ? {
              ...company,
              quarters: [
                { id, label, year, isActive: true, goals: [] },
                ...company.quarters,
              ],
            }
          : company
      )
    )
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

  function addQuarterlyGoal(quarterId: string, objective: string, yearlyGoalId: string): string {
    const id = `qg-${Date.now()}`
    patchQuarters(quarterId, (goals) => [
      ...goals,
      { id, objective, yearlyGoalId, keyResults: [] },
    ])
    return id
  }

  function updateQuarterlyGoal(quarterId: string, goalId: string, objective: string, yearlyGoalId: string) {
    patchQuarters(quarterId, (goals) =>
      goals.map((g) => g.id === goalId ? { ...g, objective, yearlyGoalId } : g)
    )
  }

  function deleteQuarterlyGoal(quarterId: string, goalId: string) {
    patchQuarters(quarterId, (goals) => goals.filter((g) => g.id !== goalId))
  }

  function addKeyResult(
    quarterId: string,
    goalId: string,
    kr: Omit<import("./mock-data").KeyResult, "id">
  ) {
    const id = `kr-${Date.now()}`
    patchQuarters(quarterId, (goals) =>
      goals.map((g) =>
        g.id === goalId ? { ...g, keyResults: [...g.keyResults, { id, ...kr }] } : g
      )
    )
  }

  function updateKeyResult(
    quarterId: string,
    goalId: string,
    krId: string,
    kr: Partial<import("./mock-data").KeyResult>
  ) {
    patchQuarters(quarterId, (goals) =>
      goals.map((g) =>
        g.id === goalId
          ? { ...g, keyResults: g.keyResults.map((k) => k.id === krId ? { ...k, ...kr } : k) }
          : g
      )
    )
  }

  function deleteKeyResult(quarterId: string, goalId: string, krId: string) {
    patchQuarters(quarterId, (goals) =>
      goals.map((g) =>
        g.id === goalId ? { ...g, keyResults: g.keyResults.filter((k) => k.id !== krId) } : g
      )
    )
  }

  function assignKROwner(quarterId: string, goalId: string, krId: string, owner: string | null) {
    patchQuarters(quarterId, (goals) =>
      goals.map((g) =>
        g.id === goalId
          ? { ...g, keyResults: g.keyResults.map((k) => k.id === krId ? { ...k, owner } : k) }
          : g
      )
    )
  }

  function updateYearlyKRConfidence(
    yearId: string,
    goalId: string,
    krId: string,
    confidence: import("./mock-data").Confidence
  ) {
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
  }

  return (
    <AppContext.Provider
      value={{
        coach: mockCoach,
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
