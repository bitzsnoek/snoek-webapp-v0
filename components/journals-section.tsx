"use client"

import { useApp } from "@/lib/store"
import { isCoachOrAdmin } from "@/lib/mock-data"
import { CoachJournalsView } from "./journal-coach-view"
import { MemberJournalsView } from "./journal-member-view"

export function JournalsSection() {
  const { currentUser } = useApp()

  if (isCoachOrAdmin(currentUser.role)) {
    return <CoachJournalsView />
  }

  return <MemberJournalsView />
}

