"use client"

import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js"

// Debounce helper to prevent too many refreshes
function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  return ((...args: unknown[]) => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }) as T
}

// Types for presence state
export interface EditingUser {
  id: string
  name: string
  avatar: string
  editingId: string | null
  editingType: "yearly_goal" | "quarterly_goal" | "key_result" | "weekly_value" | null
}

interface PresenceState {
  [key: string]: EditingUser[]
}

interface UseRealtimeGoalsOptions {
  clientId: string
  userId: string
  userName: string
  userAvatar: string
  onDataChange?: () => void
}

export function useRealtimeGoals({
  clientId,
  userId,
  userName,
  userAvatar,
  onDataChange,
}: UseRealtimeGoalsOptions) {
  const [editingUsers, setEditingUsers] = useState<Map<string, EditingUser>>(new Map())
  const [isConnected, setIsConnected] = useState(false)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const presenceChannelRef = useRef<RealtimeChannel | null>(null)

  // Track current user's editing state
  const [currentEditingId, setCurrentEditingId] = useState<string | null>(null)
  const [currentEditingType, setCurrentEditingType] = useState<EditingUser["editingType"]>(null)

  // Keep a stable reference to onDataChange
  const onDataChangeRef = useRef(onDataChange)
  onDataChangeRef.current = onDataChange

  // Debounced data change handler to prevent rapid refreshes
  const debouncedOnDataChange = useMemo(() => {
    return debounce(() => {
      console.log("[v0] Realtime: Triggering data refresh")
      onDataChangeRef.current?.()
    }, 300)
  }, []) // Empty deps - uses ref for stable reference

  // Update presence when editing state changes
  const updatePresence = useCallback(async () => {
    if (!presenceChannelRef.current) return
    
    await presenceChannelRef.current.track({
      id: userId,
      name: userName,
      avatar: userAvatar,
      editingId: currentEditingId,
      editingType: currentEditingType,
    })
  }, [userId, userName, userAvatar, currentEditingId, currentEditingType])

  // Set up real-time subscriptions
  useEffect(() => {
    if (!clientId || !userId) return

    const supabase = createClient()

    // Handler for database changes
    const handleChange = (table: string) => (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      console.log(`[v0] Realtime: ${table} ${payload.eventType}`, payload)
      debouncedOnDataChange?.()
    }

    // Create a channel for database changes
    const dbChannel = supabase
      .channel(`goals:${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "quarterly_goals",
          filter: `client_id=eq.${clientId}`,
        },
        handleChange("quarterly_goals")
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "quarterly_key_results",
        },
        handleChange("quarterly_key_results")
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "yearly_goals",
          filter: `client_id=eq.${clientId}`,
        },
        handleChange("yearly_goals")
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "yearly_key_results",
        },
        handleChange("yearly_key_results")
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "weekly_values",
        },
        handleChange("weekly_values")
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "goal_boards",
          filter: `client_id=eq.${clientId}`,
        },
        handleChange("goal_boards")
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "standard_goals",
        },
        handleChange("standard_goals")
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "standard_goal_values",
        },
        handleChange("standard_goal_values")
      )
      .subscribe((status) => {
        console.log(`[v0] Realtime: Database channel status: ${status}`)
        setIsConnected(status === "SUBSCRIBED")
      })

    channelRef.current = dbChannel

    // Create a separate channel for presence (who's editing what)
    const presenceChannel = supabase.channel(`presence:goals:${clientId}`, {
      config: {
        presence: {
          key: userId,
        },
      },
    })

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState<EditingUser>()
        const users = new Map<string, EditingUser>()
        
        Object.values(state).forEach((presences) => {
          presences.forEach((presence) => {
            if (presence.id !== userId) {
              users.set(presence.id, presence)
            }
          })
        })
        
        setEditingUsers(users)
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        setEditingUsers((prev) => {
          const next = new Map(prev)
          newPresences.forEach((presence: EditingUser) => {
            if (presence.id !== userId) {
              next.set(presence.id, presence)
            }
          })
          return next
        })
      })
      .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
        setEditingUsers((prev) => {
          const next = new Map(prev)
          leftPresences.forEach((presence: EditingUser) => {
            next.delete(presence.id)
          })
          return next
        })
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          // Track initial presence
          await presenceChannel.track({
            id: userId,
            name: userName,
            avatar: userAvatar,
            editingId: null,
            editingType: null,
          })
        }
      })

    presenceChannelRef.current = presenceChannel

    return () => {
      supabase.removeChannel(dbChannel)
      supabase.removeChannel(presenceChannel)
      channelRef.current = null
      presenceChannelRef.current = null
    }
  }, [clientId, userId, userName, userAvatar]) // debouncedOnDataChange is stable via useMemo

  // Update presence when editing state changes
  useEffect(() => {
    updatePresence()
  }, [updatePresence])

  // Start editing a goal/KR
  const startEditing = useCallback((id: string, type: EditingUser["editingType"]) => {
    setCurrentEditingId(id)
    setCurrentEditingType(type)
  }, [])

  // Stop editing
  const stopEditing = useCallback(() => {
    setCurrentEditingId(null)
    setCurrentEditingType(null)
  }, [])

  // Check if someone else is editing a specific item
  const getEditingUser = useCallback((id: string): EditingUser | null => {
    for (const user of editingUsers.values()) {
      if (user.editingId === id) {
        return user
      }
    }
    return null
  }, [editingUsers])

  // Get all users currently editing any goal
  const getAllEditingUsers = useCallback((): EditingUser[] => {
    return Array.from(editingUsers.values()).filter(u => u.editingId !== null)
  }, [editingUsers])

  return {
    isConnected,
    editingUsers,
    startEditing,
    stopEditing,
    getEditingUser,
    getAllEditingUsers,
    currentEditingId,
    currentEditingType,
  }
}
