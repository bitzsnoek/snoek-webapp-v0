"use client"

import { AppProvider } from "@/lib/store"
import { AppShell } from "@/components/app-shell"

export default function Home() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  )
}
