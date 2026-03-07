"use client"

import { useState, useEffect } from "react"
import { useApp } from "@/lib/store"
import type { Meeting } from "@/lib/mock-data"
import { Button } from "@/components/ui/button"
import { Calendar, Loader2, RefreshCw, Check } from "lucide-react"
import MeetingsHero from "./meetings-hero"
import MeetingsList from "./meetings-list"

export default function MeetingsSection() {
  const { activeCompanyId } = useApp()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [hasCalendarConnection, setHasCalendarConnection] = useState(false)
  const [connectedCalendar, setConnectedCalendar] = useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)

  // Fetch meetings on component mount
  useEffect(() => {
    loadMeetings()
  }, [activeCompanyId])

  async function loadMeetings() {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/meetings?companyId=${activeCompanyId}`)
      if (res.ok) {
        const data = await res.json()
        setMeetings(data.meetings || [])
        setHasCalendarConnection(data.hasConnection || false)
        setConnectedCalendar(data.connectedCalendar || null)
        setLastSyncedAt(data.lastSyncedAt || null)
      }
    } catch (error) {
      console.error("Failed to load meetings:", error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleManualSync() {
    setIsSyncing(true)
    try {
      const res = await fetch("/api/meetings/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: activeCompanyId }),
      })
      if (res.ok) {
        await loadMeetings()
      }
    } catch (error) {
      console.error("Sync failed:", error)
    } finally {
      setIsSyncing(false)
    }
  }

  function handleConnectCalendar() {
    window.location.href = `/api/google-calendar/connect?company_id=${activeCompanyId}`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
            <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground">Loading meetings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Meetings</h2>
          {hasCalendarConnection && connectedCalendar ? (
            <div className="flex items-center gap-2 mt-1">
              <div className="flex items-center gap-1.5 text-sm text-primary">
                <Check className="h-3.5 w-3.5" />
                <span className="font-medium">{connectedCalendar}</span>
              </div>
              {lastSyncedAt && (
                <span className="text-xs text-muted-foreground">
                  Last synced {new Date(lastSyncedAt).toLocaleString()}
                </span>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">
              Connect your Google Calendar to sync meetings
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {hasCalendarConnection && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="gap-2"
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {isSyncing ? "Syncing..." : "Sync Now"}
            </Button>
          )}
          {!hasCalendarConnection && (
            <Button size="sm" onClick={handleConnectCalendar} className="gap-2">
              <Calendar className="h-4 w-4" />
              Connect Calendar
            </Button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {meetings.length === 0 && hasCalendarConnection ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <Calendar className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-foreground">No meetings yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Your calendar is connected but there are no meetings scheduled.
          </p>
        </div>
      ) : meetings.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <Calendar className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-foreground">Connect your calendar</p>
          <p className="text-xs text-muted-foreground mt-1">
            Get started by connecting your Google Calendar to view your meetings.
          </p>
        </div>
      ) : (
        <>
          {/* Hero section: Last 2 + Next 2 meetings */}
          <MeetingsHero meetings={meetings} />

          {/* Full chronological list */}
          <MeetingsList meetings={meetings} />
        </>
      )}
    </div>
  )
}
