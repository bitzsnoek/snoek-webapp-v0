"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useApp } from "@/lib/store"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  MessageCircle,
  Send,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  FolderKanban,
  Target,
  X,
} from "lucide-react"

// Types
interface KeyResultDisplay {
  id: string
  title: string
  type: "input" | "output" | "project"
  target: number
  owner?: string | null
}

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  key_result_id: string | null // Legacy single key result
  created_at: string
  sender_name?: string
  key_result?: KeyResultDisplay | null // Legacy single key result
  key_results?: KeyResultDisplay[] // Multiple key results from junction table
}

interface Conversation {
  id: string
  company_id: string
  coach_id: string
  founder_id: string
  created_at: string
  founder_name?: string
  coach_name?: string
}

interface KeyResultOption {
  id: string
  title: string
  type: "input" | "output" | "project"
  target: number
  goalObjective: string
  owner: string | null
}

export interface ChatTab {
  odooUserId: string
  odooMemberId: string
  name: string
  conversationId?: string
  supabaseUserId?: string
  isGroup?: boolean
}

const typeConfig = {
  input: {
    label: "INPUT",
    icon: ArrowUpRight,
    color: "text-chart-2",
    bgColor: "bg-chart-2/10",
    borderColor: "border-chart-2/30",
  },
  output: {
    label: "OUTPUT",
    icon: ArrowDownRight,
    color: "text-chart-1",
    bgColor: "bg-chart-1/10",
    borderColor: "border-chart-1/30",
  },
  project: {
    label: "PROJECT",
    icon: FolderKanban,
    color: "text-chart-3",
    bgColor: "bg-chart-3/10",
    borderColor: "border-chart-3/30",
  },
}

interface ChatSectionProps {
  selectedTab?: ChatTab | null
}

export function ChatSection({ selectedTab }: ChatSectionProps) {
  const { activeCompany, currentUser } = useApp()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [goalPickerOpen, setGoalPickerOpen] = useState(false)
  const [selectedKeyResults, setSelectedKeyResults] = useState<KeyResultOption[]>([])
  const [creatingConversation, setCreatingConversation] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Get all key results from the active company for goal picker
  const allKeyResults: KeyResultOption[] = activeCompany.quarters.flatMap((quarter) =>
    quarter.goals.flatMap((goal) =>
      goal.keyResults.map((kr) => ({
        id: kr.id,
        title: kr.title,
        type: kr.type,
        target: kr.target,
        goalObjective: goal.objective,
        owner: kr.owner,
      }))
    )
  )

  // Fetch messages for current conversation
  const fetchMessages = useCallback(async (conversationId: string) => {
    const supabase = createClient()

    try {
      const { data: msgs, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })

      if (error) throw error

      // Fetch sender names
      const senderIds = [...new Set((msgs ?? []).map((m) => m.sender_id))]
      let profileMap: Record<string, string> = {}
      
      if (senderIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", senderIds)

        profileMap = Object.fromEntries(
          (profiles ?? []).map((p) => [p.id, p.full_name])
        )
      }

      // Fetch key results from the junction table (message_key_results)
      const messageIds = (msgs ?? []).map((m) => m.id)
      let messageKeyResultsMap: Record<string, KeyResultDisplay[]> = {}
      
      console.log("[v0] Fetching key results for message IDs:", messageIds)
      
      if (messageIds.length > 0) {
        const { data: mkrs, error: mkrError } = await supabase
          .from("message_key_results")
          .select("message_id, quarterly_key_result_id")
          .in("message_id", messageIds)
        
        console.log("[v0] message_key_results fetched:", mkrs, "error:", mkrError)

        // Get unique key result IDs
        const krIds = [...new Set((mkrs ?? []).map((mkr) => mkr.quarterly_key_result_id))]
        
        // Also include legacy key_result_id values
        const legacyKrIds = (msgs ?? []).filter((m) => m.key_result_id).map((m) => m.key_result_id)
        const allKrIds = [...new Set([...krIds, ...legacyKrIds])]
        
        let krMap: Record<string, { id: string; title: string; type: string; target: number; owner: string | null }> = {}
        
        if (allKrIds.length > 0) {
          const { data: krs } = await supabase
            .from("quarterly_key_results")
            .select("id, title, type, target, owner")
            .in("id", allKrIds)

          krMap = Object.fromEntries(
            (krs ?? []).map((kr) => [kr.id, kr])
          )
        }

        // Group key results by message_id
        for (const mkr of (mkrs ?? [])) {
          const kr = krMap[mkr.quarterly_key_result_id]
          if (kr) {
            if (!messageKeyResultsMap[mkr.message_id]) {
              messageKeyResultsMap[mkr.message_id] = []
            }
            messageKeyResultsMap[mkr.message_id].push({
              id: kr.id,
              title: kr.title,
              type: (kr.type === "input" ? "input" : kr.type === "project" ? "project" : "output") as "input" | "output" | "project",
              target: kr.target,
              owner: kr.owner,
            })
          }
        }

        // Also handle legacy key_result_id
        for (const msg of (msgs ?? [])) {
          if (msg.key_result_id && krMap[msg.key_result_id]) {
            const kr = krMap[msg.key_result_id]
            const legacyKr: KeyResultDisplay = {
              id: kr.id,
              title: kr.title,
              type: (kr.type === "input" ? "input" : kr.type === "project" ? "project" : "output") as "input" | "output" | "project",
              owner: kr.owner,
              target: kr.target,
            }
            // Add to list if not already present from junction table
            if (!messageKeyResultsMap[msg.id]) {
              messageKeyResultsMap[msg.id] = [legacyKr]
            } else if (!messageKeyResultsMap[msg.id].some((k) => k.id === legacyKr.id)) {
              messageKeyResultsMap[msg.id].push(legacyKr)
            }
          }
        }
      }

      console.log("[v0] Final messageKeyResultsMap:", messageKeyResultsMap)
      
      const enrichedMessages: Message[] = (msgs ?? []).map((m) => ({
        ...m,
        sender_name: profileMap[m.sender_id] || "Unknown",
        key_results: messageKeyResultsMap[m.id] || [],
      }))

      console.log("[v0] Enriched messages with key_results:", enrichedMessages.map(m => ({ id: m.id, key_results: m.key_results })))
      
      setMessages(enrichedMessages)
    } catch (err) {
      console.error("Error fetching messages:", err)
    }
  }, [])

  // Send a message
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedTab?.conversationId || sending) return

    const supabase = createClient()
    setSending(true)
    const messageContent = newMessage.trim()

    try {
      // Insert the message (keep key_result_id null for new messages, use junction table instead)
      const { data: newMsg, error } = await supabase.from("messages").insert({
        conversation_id: selectedTab.conversationId,
        sender_id: currentUser.id,
        content: messageContent,
        key_result_id: null,
      }).select("id").single()

      if (error) throw error

      // Insert key results into junction table
      if (selectedKeyResults.length > 0 && newMsg) {
        const keyResultInserts = selectedKeyResults.map((kr) => ({
          message_id: newMsg.id,
          quarterly_key_result_id: kr.id,
        }))
        
        const { error: krError } = await supabase
          .from("message_key_results")
          .insert(keyResultInserts)
        
        if (krError) {
          console.error("Error inserting key results:", krError)
        }
      }

      setNewMessage("")
      setSelectedKeyResults([])
      
      // Refresh messages
      await fetchMessages(selectedTab.conversationId)

      // Send push notification to the other participant
      try {
        await fetch("/api/chat/send-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: selectedTab.conversationId,
            senderId: currentUser.id,
            content: messageContent,
          }),
        })
      } catch (notifErr) {
        console.error("Failed to send push notification:", notifErr)
      }
    } catch (err) {
      console.error("Error sending message:", err)
    } finally {
      setSending(false)
    }
  }

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Fetch messages when tab changes
  useEffect(() => {
    if (selectedTab?.conversationId) {
      fetchMessages(selectedTab.conversationId)
    } else {
      setMessages([])
    }
  }, [selectedTab?.conversationId, fetchMessages])

  // Set up real-time subscription for new messages
  useEffect(() => {
    if (!selectedTab?.conversationId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`messages:${selectedTab.conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selectedTab.conversationId}`,
        },
        () => {
          fetchMessages(selectedTab.conversationId!)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedTab?.conversationId, fetchMessages])

  // Format timestamp
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    } else if (diffDays === 1) {
      return "Yesterday"
    } else if (diffDays < 7) {
      return date.toLocaleDateString("en-US", { weekday: "short" })
    } else {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    }
  }

  // Determine if current user is the sender
  const isSender = (senderId: string) => senderId === currentUser.id

  // No tab selected state
  if (!selectedTab) {
    return (
      <div className="mx-auto flex h-[calc(100dvh-8rem)] max-w-3xl items-center justify-center">
        <div className="text-center">
          <MessageCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            Select a conversation to start chatting
          </p>
        </div>
      </div>
    )
  }

  // Create a new 1-on-1 conversation
  const createConversation = async () => {
    if (!selectedTab || !activeCompany.id || !currentUser.id) return
    
    setCreatingConversation(true)
    const supabase = createClient()

    try {
      // Determine coach_id and founder_id based on current user's role
      const coachId = currentUser.role === "coach" ? currentUser.id : selectedTab.supabaseUserId
      const founderId = currentUser.role === "founder" ? currentUser.id : selectedTab.supabaseUserId

      // We need to find the supabase user ID for the other person
      // Look up the member's user_id from company_members
      const { data: memberData } = await supabase
        .from("company_members")
        .select("user_id")
        .eq("id", selectedTab.odooMemberId)
        .single()

      const otherUserId = memberData?.user_id

      if (!otherUserId) {
        console.error("Could not find user ID for member")
        setCreatingConversation(false)
        return
      }

      const finalCoachId = currentUser.role === "coach" ? currentUser.id : otherUserId
      const finalFounderId = currentUser.role === "founder" ? currentUser.id : otherUserId

      const { data: newConvo, error } = await supabase
        .from("conversations")
        .insert({
          company_id: activeCompany.id,
          coach_id: finalCoachId,
          founder_id: finalFounderId,
          is_group: false,
        })
        .select()
        .single()

      if (error) {
        console.error("Error creating conversation:", error)
        setCreatingConversation(false)
        return
      }

      // Trigger a refresh of the chat tabs by reloading the page section
      // The parent component will refetch and update the conversationId
      window.location.reload()
    } catch (err) {
      console.error("Error creating conversation:", err)
    } finally {
      setCreatingConversation(false)
    }
  }

  // No conversation exists yet (only for 1-on-1 chats, group chats are created on demand)
  if (!selectedTab.conversationId && !selectedTab.isGroup) {
    return (
      <div className="mx-auto flex h-[calc(100dvh-8rem)] max-w-3xl items-center justify-center">
        <div className="text-center">
          <MessageCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            No conversation with {selectedTab.name} yet.
          </p>
          <Button 
            onClick={createConversation} 
            disabled={creatingConversation}
            className="mt-4"
          >
            {creatingConversation ? "Starting..." : "Start Conversation"}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col overflow-hidden">
      {/* Messages */}
      <ScrollArea className="min-h-0 flex-1 p-4">
            <div className="flex flex-col gap-3">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <MessageCircle className="mb-3 h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">
                    No messages yet. Start the conversation!
                  </p>
                </div>
              ) : (
                messages.map((message) => {
                  const isOwnMessage = isSender(message.sender_id)
                  return (
                    <div
                      key={message.id}
                      className={cn(
                        "flex flex-col max-w-[85%]",
                        isOwnMessage ? "ml-auto items-end" : "mr-auto items-start"
                      )}
                    >
                      {/* Show sender name for group chats (only for other people's messages) */}
                      {selectedTab?.isGroup && !isOwnMessage && message.sender_name && (
                        <span className="mb-1 px-2 text-xs font-medium text-muted-foreground">
                          {message.sender_name}
                        </span>
                      )}
                      <div
                        className={cn(
                          "rounded-2xl px-4 py-2.5",
                          isOwnMessage
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground"
                        )}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        
                        {/* Attached Key Results */}
                        {message.key_results && message.key_results.length > 0 && (
                          <div className="mt-2 flex flex-col gap-2">
                            {message.key_results.map((kr) => (
                              <div
                                key={kr.id}
                                className={cn(
                                  "rounded-lg border p-3",
                                  isOwnMessage
                                    ? "border-primary-foreground/20 bg-primary-foreground/10"
                                    : "border-border bg-background/50"
                                )}
                              >
                                <p
                                  className={cn(
                                    "text-sm font-medium",
                                    isOwnMessage ? "text-primary-foreground" : "text-foreground"
                                  )}
                                >
                                  {kr.title}
                                </p>
                                <p
                                  className={cn(
                                    "mt-0.5 text-xs",
                                    isOwnMessage
                                      ? "text-primary-foreground/70"
                                      : "text-muted-foreground"
                                  )}
                                >
                                  {typeConfig[kr.type].label} · Target {kr.target}{kr.owner ? ` · ${kr.owner}` : ""}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="mt-1 px-2 text-[10px] text-muted-foreground">
                        {formatTime(message.created_at)}
                      </span>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Bottom section - selected goals + input */}
      <div className="shrink-0">
        {/* Selected Goals Preview */}
        {selectedKeyResults.length > 0 && (
          <div className="border-t border-border bg-secondary/30 px-4 py-2">
            <div className="flex flex-wrap items-center gap-2">
              {selectedKeyResults.map((kr) => (
                <div
                  key={kr.id}
                  className="flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1"
                >
                  <Target className="h-3 w-3 text-primary" />
                  <span className="max-w-[150px] truncate text-xs text-foreground">
                    {kr.title}
                  </span>
                  <button
                    onClick={() =>
                      setSelectedKeyResults((prev) =>
                        prev.filter((k) => k.id !== kr.id)
                      )
                    }
                    className="ml-0.5 rounded-full p-0.5 hover:bg-background/50"
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-border">
          <div className="flex items-center gap-2 p-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-full"
              onClick={() => setGoalPickerOpen(true)}
              title="Attach a goal"
            >
              <Plus className="h-5 w-5" />
            </Button>
            <Input
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder="Message"
              className="flex-1 rounded-full border-border bg-secondary/50"
            />
            <Button
              size="icon"
              className="h-10 w-10 shrink-0 rounded-full"
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending}
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Goal Picker Dialog */}
      <Dialog open={goalPickerOpen} onOpenChange={setGoalPickerOpen}>
        <DialogContent className="max-h-[80vh] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Attach Goals</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="flex flex-col gap-2 pr-4">
              {allKeyResults.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No goals available to attach.
                </p>
              ) : (
                allKeyResults.map((kr) => {
                  const config = typeConfig[kr.type]
                  const TypeIcon = config.icon
                  const isSelected = selectedKeyResults.some((k) => k.id === kr.id)
                  return (
                    <button
                      key={kr.id}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedKeyResults((prev) =>
                            prev.filter((k) => k.id !== kr.id)
                          )
                        } else {
                          setSelectedKeyResults((prev) => [...prev, kr])
                        }
                      }}
                      className={cn(
                        "flex flex-col items-start rounded-lg border p-3 text-left transition-colors hover:bg-secondary/50",
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border"
                      )}
                    >
                      <div className="flex w-full items-start gap-2">
                        <div className={cn("mt-0.5 rounded p-1", config.bgColor)}>
                          <TypeIcon className={cn("h-3 w-3", config.color)} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{kr.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {config.label} · Target {kr.target}{kr.owner ? ` · ${kr.owner}` : ""}
                          </p>
                          <p className="mt-1 truncate text-xs text-muted-foreground/70">
                            {kr.goalObjective}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                            <span className="text-xs font-medium text-primary-foreground">
                              {selectedKeyResults.findIndex((k) => k.id === kr.id) + 1}
                            </span>
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </ScrollArea>
          {selectedKeyResults.length > 0 && (
            <div className="flex justify-end border-t pt-4">
              <Button onClick={() => {
                setGoalPickerOpen(false)
                inputRef.current?.focus()
              }}>
                Done ({selectedKeyResults.length} selected)
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
