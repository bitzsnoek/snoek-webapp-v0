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
