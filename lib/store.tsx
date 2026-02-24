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
}

const AppContext = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>(mockCompanies)
  const [activeCompanyId, setActiveCompanyId] = useState(mockCompanies[0].id)

  const activeCompany = companies.find((c) => c.id === activeCompanyId) ?? companies[0]

  return (
    <AppContext.Provider
      value={{
        coach: mockCoach,
        companies,
        activeCompanyId,
        activeCompany,
        setActiveCompanyId,
        setCompanies,
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
