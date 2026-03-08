"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useApp } from "@/lib/store"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import {
  MessageCircle,
  Send,
  Plus,
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  FolderKanban,
  Target,
  X,
} from "lucide-react"

// Types
interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  key_result_id: string | null
  created_at: string
  sender_name?: string
  key_result?: {
    id: string
    title: string
    type: "input" | "output" | "project"
    target: number
  } | null
}

interface Conversation {
  id: string
  company_id: string
  coach_id: string
  founder_id: string
  created_at: string
  founder_name?: string
  coach_name?: string
  last_message?: string
  last_message_at?: string
}

interface KeyResultOption {
  id: string
  title: string
  type: "input" | "output" | "project"
  target: number
  goalObjective: string
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

export function ChatSection() {
  const { activeCompany, currentUser } = useApp()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [goalPickerOpen, setGoalPickerOpen] = useState(false)
  const [selectedKeyResult, setSelectedKeyResult] = useState<KeyResultOption | null>(null)
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
      }))
    )
  )

  // Fetch conversations for the active company
  const fetchConversations = useCallback(async () => {
    const supabase = createClient()
    setLoading(true)

    try {
      const { data: convos, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("company_id", activeCompany.id)
        .order("created_at", { ascending: false })

      if (error) throw error

      // Fetch profile names for founders and coaches
      const founderIds = [...new Set((convos ?? []).map((c) => c.founder_id))]
      const coachIds = [...new Set((convos ?? []).map((c) => c.coach_id))]
      const allUserIds = [...new Set([...founderIds, ...coachIds])]

      let profileMap: Record<string, string> = {}
      if (allUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", allUserIds)

        profileMap = Object.fromEntries(
          (profiles ?? []).map((p) => [p.id, p.full_name])
        )
      }

      // Fetch last message for each conversation
      const convoIds = (convos ?? []).map((c) => c.id)
      let lastMessages: Record<string, { content: string; created_at: string }> = {}
      
      if (convoIds.length > 0) {
        const { data: msgs } = await supabase
          .from("messages")
          .select("conversation_id, content, created_at")
          .in("conversation_id", convoIds)
          .order("created_at", { ascending: false })

        // Group by conversation and get the latest
        for (const msg of msgs ?? []) {
          if (!lastMessages[msg.conversation_id]) {
            lastMessages[msg.conversation_id] = {
              content: msg.content,
              created_at: msg.created_at,
            }
          }
        }
      }

      const enrichedConvos: Conversation[] = (convos ?? []).map((c) => ({
        ...c,
        founder_name: profileMap[c.founder_id] || "Founder",
        coach_name: profileMap[c.coach_id] || "Coach",
        last_message: lastMessages[c.id]?.content,
        last_message_at: lastMessages[c.id]?.created_at,
      }))

      // Sort by last message time
      enrichedConvos.sort((a, b) => {
        const aTime = a.last_message_at || a.created_at
        const bTime = b.last_message_at || b.created_at
        return new Date(bTime).getTime() - new Date(aTime).getTime()
      })

      setConversations(enrichedConvos)
    } catch (err) {
      console.error("Error fetching conversations:", err)
    } finally {
      setLoading(false)
    }
  }, [activeCompany.id])

  // Fetch messages for selected conversation
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

      // Fetch key results for messages that have them
      const krIds = (msgs ?? []).filter((m) => m.key_result_id).map((m) => m.key_result_id)
      let krMap: Record<string, { id: string; title: string; type: string; target: number }> = {}
      
      if (krIds.length > 0) {
        const { data: krs } = await supabase
          .from("quarterly_key_results")
          .select("id, title, type, target")
          .in("id", krIds)

        krMap = Object.fromEntries(
          (krs ?? []).map((kr) => [kr.id, kr])
        )
      }

      const enrichedMessages: Message[] = (msgs ?? []).map((m) => ({
        ...m,
        sender_name: profileMap[m.sender_id] || "Unknown",
        key_result: m.key_result_id ? {
          id: krMap[m.key_result_id]?.id,
          title: krMap[m.key_result_id]?.title || "Goal",
          type: (krMap[m.key_result_id]?.type === "input" ? "input" : 
                 krMap[m.key_result_id]?.type === "project" ? "project" : "output") as "input" | "output" | "project",
          target: krMap[m.key_result_id]?.target || 0,
        } : null,
      }))

      setMessages(enrichedMessages)
    } catch (err) {
      console.error("Error fetching messages:", err)
    }
  }, [])

  // Send a message
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || sending) return

    const supabase = createClient()
    setSending(true)
    const messageContent = newMessage.trim()

    try {
      const { error } = await supabase.from("messages").insert({
        conversation_id: selectedConversation.id,
        sender_id: currentUser.id,
        content: messageContent,
        key_result_id: selectedKeyResult?.id || null,
      })

      if (error) throw error

      setNewMessage("")
      setSelectedKeyResult(null)
      
      // Refresh messages
      await fetchMessages(selectedConversation.id)
      
      // Update conversation list to show new last message
      fetchConversations()

      // Send push notification to the other participant
      try {
        await fetch("/api/chat/send-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: selectedConversation.id,
            senderId: currentUser.id,
            content: messageContent,
          }),
        })
      } catch (notifErr) {
        // Don't fail the message send if notification fails
        console.error("Failed to send push notification:", notifErr)
      }
    } catch (err) {
      console.error("Error sending message:", err)
    } finally {
      setSending(false)
    }
  }

  // Create or get conversation with a founder
  const getOrCreateConversation = async (founderId: string) => {
    const supabase = createClient()
    const coachId = activeCompany.members?.find((m) => m.role === "coach")?.id || currentUser.id

    // Check if conversation already exists
    const existing = conversations.find(
      (c) => c.founder_id === founderId && c.coach_id === coachId
    )

    if (existing) {
      setSelectedConversation(existing)
      return
    }

    // Create new conversation
    try {
      const { data, error } = await supabase
        .from("conversations")
        .insert({
          company_id: activeCompany.id,
          coach_id: coachId,
          founder_id: founderId,
        })
        .select()
        .single()

      if (error) throw error

      // Fetch the profile name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", founderId)
        .single()

      const newConvo: Conversation = {
        ...data,
        founder_name: profile?.full_name || "Founder",
        coach_name: currentUser.name,
      }

      setConversations((prev) => [newConvo, ...prev])
      setSelectedConversation(newConvo)
    } catch (err) {
      console.error("Error creating conversation:", err)
    }
  }

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Fetch conversations on mount and when company changes
  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // Fetch messages when conversation is selected
  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id)
    }
  }, [selectedConversation, fetchMessages])

  // Set up real-time subscription for new messages
  useEffect(() => {
    if (!selectedConversation) return

    const supabase = createClient()
    const channel = supabase
      .channel(`messages:${selectedConversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selectedConversation.id}`,
        },
        () => {
          fetchMessages(selectedConversation.id)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedConversation, fetchMessages])

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

  // Get founders who don't have a conversation yet
  const foundersWithoutConversation = activeCompany.members
    ?.filter((m) => m.role === "founder")
    .filter((f) => {
      // Check if there's a conversation with this founder
      // For coaches: check if they have a conversation with this founder
      // For founders: they can only see their own conversation
      if (currentUser.role === "founder") {
        return false // Founders don't start new conversations
      }
      
      // Find the founder's user_id from company_members
      const founderMember = activeCompany.members?.find((m) => m.id === f.id)
      if (!founderMember) return true
      
      // Check if a conversation exists with this founder's user
      return !conversations.some((c) => {
        // Match by name since we might not have user_id
        return c.founder_name === f.name
      })
    }) || []

  // Determine if current user is the sender
  const isSender = (senderId: string) => senderId === currentUser.id

  // Get the other participant's name for the conversation
  const getOtherParticipantName = (convo: Conversation) => {
    if (currentUser.role === "coach") {
      return convo.founder_name
    }
    return convo.coach_name
  }

  const getOtherParticipantInitials = (convo: Conversation) => {
    const name = getOtherParticipantName(convo)
    return name?.split(" ").map((n) => n[0]).join("").toUpperCase() || "?"
  }

  return (
    <div className="mx-auto h-[calc(100dvh-8rem)] max-w-5xl">
      <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card">
        {/* Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          {selectedConversation ? (
            <>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 md:hidden"
                  onClick={() => setSelectedConversation(null)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/20 text-xs font-semibold text-primary">
                    {getOtherParticipantInitials(selectedConversation)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {getOtherParticipantName(selectedConversation)}
                  </p>
                  <p className="text-xs text-muted-foreground">{activeCompany.name}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Chat</h2>
            </div>
          )}
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Conversation List - Hidden on mobile when conversation is selected */}
          <div
            className={cn(
              "flex w-full flex-col border-r border-border md:w-80",
              selectedConversation && "hidden md:flex"
            )}
          >
            {/* New Chat Button for Coaches */}
            {currentUser.role === "coach" && foundersWithoutConversation.length > 0 && (
              <div className="border-b border-border p-3">
                <Dialog>
                  <Button variant="outline" size="sm" className="w-full gap-2">
                    <Plus className="h-4 w-4" />
                    New Chat
                  </Button>
                </Dialog>
              </div>
            )}

            {/* Conversations */}
            <ScrollArea className="flex-1">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <MessageCircle className="mb-3 h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground text-center">No conversations yet</p>
                  {currentUser.role === "coach" && (
                    <p className="mt-1 text-xs text-muted-foreground/70 text-center">
                      Conversations are created when founders message you from the mobile app
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col">
                  {conversations.map((convo) => (
                    <button
                      key={convo.id}
                      onClick={() => setSelectedConversation(convo)}
                      className={cn(
                        "flex items-start gap-3 border-b border-border/50 p-4 text-left transition-colors hover:bg-secondary/50",
                        selectedConversation?.id === convo.id && "bg-secondary"
                      )}
                    >
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                          {getOtherParticipantInitials(convo)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium text-foreground">
                            {getOtherParticipantName(convo)}
                          </p>
                          {convo.last_message_at && (
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {formatTime(convo.last_message_at)}
                            </span>
                          )}
                        </div>
                        {convo.last_message && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {convo.last_message}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Message Area */}
          <div
            className={cn(
              "flex flex-1 flex-col",
              !selectedConversation && "hidden md:flex"
            )}
          >
            {selectedConversation ? (
              <>
                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="flex flex-col gap-3">
                    {messages.map((message) => {
                      const isOwnMessage = isSender(message.sender_id)
                      return (
                        <div
                          key={message.id}
                          className={cn(
                            "flex flex-col max-w-[85%]",
                            isOwnMessage ? "ml-auto items-end" : "mr-auto items-start"
                          )}
                        >
                          <div
                            className={cn(
                              "rounded-2xl px-4 py-2.5",
                              isOwnMessage
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-secondary-foreground"
                            )}
                          >
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            
                            {/* Attached Key Result */}
                            {message.key_result && (
                              <div
                                className={cn(
                                  "mt-2 rounded-lg border p-3",
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
                                  {message.key_result.title}
                                </p>
                                <p
                                  className={cn(
                                    "mt-0.5 text-xs",
                                    isOwnMessage
                                      ? "text-primary-foreground/70"
                                      : "text-muted-foreground"
                                  )}
                                >
                                  {typeConfig[message.key_result.type].label} · Target {message.key_result.target}
                                </p>
                              </div>
                            )}
                          </div>
                          <span className="mt-1 px-2 text-[10px] text-muted-foreground">
                            {formatTime(message.created_at)}
                          </span>
                        </div>
                      )
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Selected Goal Preview */}
                {selectedKeyResult && (
                  <div className="border-t border-border bg-secondary/30 px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      <span className="flex-1 truncate text-xs text-foreground">
                        {selectedKeyResult.title}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setSelectedKeyResult(null)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Input Area */}
                <div className="border-t border-border p-3">
                  <div className="flex items-center gap-2">
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
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center px-4">
                <MessageCircle className="mb-4 h-12 w-12 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">
                  Select a conversation to start chatting
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Goal Picker Dialog */}
      <Dialog open={goalPickerOpen} onOpenChange={setGoalPickerOpen}>
        <DialogContent className="max-h-[80vh] overflow-hidden sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Attach a Goal
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="flex flex-col gap-2">
              {allKeyResults.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No goals available to attach
                </p>
              ) : (
                allKeyResults.map((kr) => {
                  const config = typeConfig[kr.type]
                  const TypeIcon = config.icon
                  return (
                    <button
                      key={kr.id}
                      onClick={() => {
                        setSelectedKeyResult(kr)
                        setGoalPickerOpen(false)
                        inputRef.current?.focus()
                      }}
                      className={cn(
                        "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors hover:bg-secondary",
                        selectedKeyResult?.id === kr.id
                          ? "border-primary bg-primary/5"
                          : "border-border"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded",
                            config.bgColor
                          )}
                        >
                          <TypeIcon className={cn("h-3 w-3", config.color)} />
                        </div>
                        <span className="text-sm font-medium text-foreground">
                          {kr.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pl-8">
                        <Badge variant="outline" className={cn("text-xs", config.color)}>
                          {config.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Target {kr.target}
                        </span>
                      </div>
                      <p className="pl-8 text-xs text-muted-foreground/70 line-clamp-1">
                        {kr.goalObjective}
                      </p>
                    </button>
                  )
                })
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}
