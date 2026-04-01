"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"

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
  companyId: string
  userId: string
  userName: string
  userAvatar: string
  onDataChange?: () => void
}

export function useRealtimeGoals({
  companyId,
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
    if (!companyId || !userId) return

    const supabase = createClient()

    // Create a channel for database changes
    const dbChannel = supabase
      .channel(`goals:${companyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "quarterly_goals",
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          onDataChange?.()
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "quarterly_key_results",
        },
        (payload) => {
          // We need to check if this belongs to our company via the goal
          // For simplicity, we'll refresh on any change and let the data fetching filter
          onDataChange?.()
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "yearly_goals",
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          onDataChange?.()
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "yearly_key_results",
        },
        () => {
          onDataChange?.()
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "weekly_values",
        },
        () => {
          onDataChange?.()
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED")
      })

    channelRef.current = dbChannel

    // Create a separate channel for presence (who's editing what)
    const presenceChannel = supabase.channel(`presence:goals:${companyId}`, {
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
  }, [companyId, userId, userName, userAvatar, onDataChange])

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
