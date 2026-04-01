"use client"

import { createContext, useContext, type ReactNode } from "react"
import { useRealtimeGoals, type EditingUser } from "./use-realtime-goals"
import { useApp } from "./store"

interface RealtimeGoalsContextValue {
  isConnected: boolean
  startEditing: (id: string, type: EditingUser["editingType"]) => void
  stopEditing: () => void
  getEditingUser: (id: string) => EditingUser | null
  getAllEditingUsers: () => EditingUser[]
  currentEditingId: string | null
  currentEditingType: EditingUser["editingType"]
}

const RealtimeGoalsContext = createContext<RealtimeGoalsContextValue | null>(null)

export function RealtimeGoalsProvider({ children }: { children: ReactNode }) {
  const { activeCompany, currentUser, refreshData } = useApp()

  const initials = currentUser.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  const realtimeGoals = useRealtimeGoals({
    companyId: activeCompany.id,
    userId: currentUser.id,
    userName: currentUser.name,
    userAvatar: initials,
    onDataChange: refreshData,
  })

  return (
    <RealtimeGoalsContext.Provider value={realtimeGoals}>
      {children}
    </RealtimeGoalsContext.Provider>
  )
}

export function useRealtimeGoalsContext() {
  const context = useContext(RealtimeGoalsContext)
  if (!context) {
    throw new Error("useRealtimeGoalsContext must be used within a RealtimeGoalsProvider")
  }
  return context
}

// Optional hook that returns null if not in provider (for non-realtime contexts)
export function useOptionalRealtimeGoals() {
  return useContext(RealtimeGoalsContext)
}
