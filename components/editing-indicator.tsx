"use client"

import { useOptionalRealtimeGoals } from "@/lib/realtime-goals-context"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface EditingIndicatorProps {
  itemId: string
  className?: string
  showInline?: boolean
}

export function EditingIndicator({ itemId, className, showInline = false }: EditingIndicatorProps) {
  const realtimeContext = useOptionalRealtimeGoals()
  
  if (!realtimeContext) return null
  
  const editingUser = realtimeContext.getEditingUser(itemId)
  
  if (!editingUser) return null

  if (showInline) {
    return (
      <div className={cn("flex items-center gap-1.5 text-xs text-amber-500", className)}>
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
        </span>
        <span className="font-medium">{editingUser.name}</span>
        <span className="text-muted-foreground">is editing</span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-500",
        className
      )}
      title={`${editingUser.name} is editing this`}
    >
      <Avatar className="h-4 w-4">
        <AvatarFallback className="bg-amber-500/20 text-[8px] text-amber-600">
          {editingUser.avatar}
        </AvatarFallback>
      </Avatar>
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
      </span>
    </div>
  )
}

// Shows all users currently editing goals (for header/sidebar)
export function ActiveEditorsIndicator({ className }: { className?: string }) {
  const realtimeContext = useOptionalRealtimeGoals()
  
  if (!realtimeContext) return null
  
  const editingUsers = realtimeContext.getAllEditingUsers()
  
  if (editingUsers.length === 0) return null

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="flex -space-x-1.5">
        {editingUsers.slice(0, 3).map((user) => (
          <Avatar
            key={user.id}
            className="h-5 w-5 border-2 border-background"
            title={`${user.name} is editing`}
          >
            <AvatarFallback className="bg-amber-500/20 text-[8px] text-amber-600">
              {user.avatar}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
      {editingUsers.length > 3 && (
        <span className="text-xs text-muted-foreground">+{editingUsers.length - 3}</span>
      )}
      <span className="ml-1 text-xs text-amber-500">editing</span>
    </div>
  )
}

// Connection status indicator
export function RealtimeConnectionStatus({ className }: { className?: string }) {
  const realtimeContext = useOptionalRealtimeGoals()
  
  if (!realtimeContext) return null

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs",
        realtimeContext.isConnected ? "text-emerald-500" : "text-muted-foreground",
        className
      )}
      title={realtimeContext.isConnected ? "Real-time sync active" : "Connecting..."}
    >
      <span className="relative flex h-2 w-2">
        {realtimeContext.isConnected ? (
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        ) : (
          <>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-muted-foreground opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-muted-foreground" />
          </>
        )}
      </span>
      <span className="hidden sm:inline">
        {realtimeContext.isConnected ? "Live" : "Connecting"}
      </span>
    </div>
  )
}
