"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useApp } from "@/lib/store"
import { isCoachOrAdmin, getActiveJournals, getCurrentPeriodKey, formatPeriodKey, getJournalFrequencyLabel, type GoalFrequency } from "@/lib/mock-data"
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
  Reply,
  BookOpen,
  Check,
} from "lucide-react"

// Types
interface KeyResultDisplay {
  id: string
  title: string
  type: "input" | "output" | "project"
  target: number
  owner?: string | null
}

// A journal period attached to a chat message. `id` is the underlying
// `journals.id` (the attachment is keyed by journal + period_key, matching
// the mobile app's `message_journal_attachments` table). Content is resolved
// lazily from the currently loaded journal entries.
interface JournalEntryDisplay {
  id: string
  journalTitle: string
  periodKey: string
  content: string
  frequency: string
}

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  key_result_id: string | null // Legacy single key result
  created_at: string
  reply_to_message_id?: string | null // Reply to another message
  sender_name?: string
  key_result?: KeyResultDisplay | null // Legacy single key result
  key_results?: KeyResultDisplay[] // Multiple key results from junction table
  journal_entries?: JournalEntryDisplay[] // Attached journal entries
  reply_to_message?: {
    id: string
    content: string
    sender_name: string
  } | null
}

interface Conversation {
  id: string
  client_id: string
  coach_id: string
  member_id: string
  created_at: string
  member_name?: string
  coach_name?: string
}

interface KeyResultOption {
  id: string
  title: string
  type: "input" | "output" | "project"
  target: number
  goalObjective: string
  owner: string | null
  source?: "okr" | "standard"  // distinguish OKR vs standard goals in picker
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
  const { activeClient, currentUser, setPendingJournalNav } = useApp()
  const viewerIsCoach = isCoachOrAdmin(currentUser.role)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [goalPickerOpen, setGoalPickerOpen] = useState(false)
  const [selectedKeyResults, setSelectedKeyResults] = useState<KeyResultOption[]>([])
  const [selectedJournalEntries, setSelectedJournalEntries] = useState<JournalEntryDisplay[]>([])
  const [creatingConversation, setCreatingConversation] = useState(false)
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Get all key results from OKR + standard goals for goal picker
  const okrKeyResults: KeyResultOption[] = activeClient.quarters.flatMap((quarter) =>
    quarter.goals.flatMap((goal) =>
      goal.keyResults.map((kr) => ({
        id: kr.id,
        title: kr.title,
        type: kr.type,
        target: kr.target,
        goalObjective: goal.objective,
        owner: kr.owner,
        source: "okr" as const,
      }))
    )
  )
  const standardGoalOptions: KeyResultOption[] = (activeClient.boards ?? [])
    .filter((b) => b.isActive)
    .flatMap((board) =>
      board.goals.map((g) => ({
        id: g.id,
        title: g.title,
        type: "output" as const, // display as output-style
        target: g.targetValue,
        goalObjective: board.title,
        owner: g.owner,
        source: "standard" as const,
      }))
    )
  const allKeyResults: KeyResultOption[] = [...okrKeyResults, ...standardGoalOptions]

  // Build journal entry options for the picker (current period entries only).
  // `id` is the journal_id — the new attachment model keys by (journal, period),
  // not by a specific entry row.
  const journalEntryOptions: JournalEntryDisplay[] = getActiveJournals(activeClient).flatMap((journal) => {
    const currentKey = getCurrentPeriodKey(journal.frequency as GoalFrequency)
    const entry = journal.entries[currentKey]
    if (!entry || !entry.content.trim()) return []
    return [{
      id: journal.id,
      journalTitle: journal.title,
      periodKey: currentKey,
      content: entry.content,
      frequency: journal.frequency,
    }]
  })

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
      let messageJournalEntriesMap: Record<string, JournalEntryDisplay[]> = {}

      if (messageIds.length > 0) {
        // Fetch message_key_results with joined quarterly_key_results data
        const { data: mkrs, error: mkrError } = await supabase
          .from("message_key_results")
          .select(`
            message_id,
            quarterly_key_result_id,
            quarterly_key_results (
              id,
              title,
              type,
              target
            )
          `)
          .in("message_id", messageIds)
        
        if (mkrError) {
          console.error("Error fetching message_key_results:", mkrError)
        }

        // Build messageKeyResultsMap from joined data
        for (const mkr of (mkrs ?? [])) {
          const kr = mkr.quarterly_key_results as { id: string; title: string; type: string; target: number } | null
          if (kr) {
            if (!messageKeyResultsMap[mkr.message_id]) {
              messageKeyResultsMap[mkr.message_id] = []
            }
            messageKeyResultsMap[mkr.message_id].push({
              id: kr.id,
              title: kr.title,
              type: (kr.type === "input" ? "input" : kr.type === "project" ? "project" : "output") as "input" | "output" | "project",
              target: kr.target,
            })
          }
        }

        // Fetch standard goals from message_standard_goals
        const { data: msgs_sg, error: sgError } = await supabase
          .from("message_standard_goals")
          .select(`
            message_id,
            standard_goal_id,
            standard_goals (
              id,
              title,
              target_value
            )
          `)
          .in("message_id", messageIds)

        if (sgError) {
          console.error("Error fetching message_standard_goals:", sgError)
        }

        for (const msg_sg of (msgs_sg ?? [])) {
          const sg = msg_sg.standard_goals as { id: string; title: string; target_value: number } | null
          if (sg) {
            if (!messageKeyResultsMap[msg_sg.message_id]) {
              messageKeyResultsMap[msg_sg.message_id] = []
            }
            messageKeyResultsMap[msg_sg.message_id].push({
              id: sg.id,
              title: sg.title,
              type: "output",
              target: sg.target_value,
            })
          }
        }

        // Fetch journal attachments (period-based, matches mobile). Content
        // is resolved from the currently loaded journal entries below.
        const { data: mjas, error: mjaError } = await supabase
          .from("message_journal_attachments")
          .select("message_id, journal_id, period_key")
          .in("message_id", messageIds)

        if (mjaError) {
          console.error("Error fetching message_journal_attachments:", mjaError)
        }

        const journalsById = new Map((activeClient.journals ?? []).map((j) => [j.id, j]))

        for (const mja of (mjas ?? []) as { message_id: string; journal_id: string; period_key: string }[]) {
          const journal = journalsById.get(mja.journal_id)
          if (!journal) continue
          const entry = journal.entries?.[mja.period_key]
          if (!messageJournalEntriesMap[mja.message_id]) {
            messageJournalEntriesMap[mja.message_id] = []
          }
          messageJournalEntriesMap[mja.message_id].push({
            id: journal.id,
            journalTitle: journal.title,
            periodKey: mja.period_key,
            content: entry?.content ?? "",
            frequency: journal.frequency,
          })
        }

        // Also handle legacy key_result_id - fetch separately if needed
        const legacyKrIds = (msgs ?? []).filter((m) => m.key_result_id).map((m) => m.key_result_id).filter(Boolean)
        if (legacyKrIds.length > 0) {
          const { data: legacyKrs } = await supabase
            .from("quarterly_key_results")
            .select("id, title, type, target")
            .in("id", legacyKrIds)
          
          const legacyKrMap = Object.fromEntries((legacyKrs ?? []).map((kr) => [kr.id, kr]))
          
          for (const msg of (msgs ?? [])) {
            if (msg.key_result_id && legacyKrMap[msg.key_result_id]) {
              const kr = legacyKrMap[msg.key_result_id]
              const legacyKr: KeyResultDisplay = {
                id: kr.id,
                title: kr.title,
                type: (kr.type === "input" ? "input" : kr.type === "project" ? "project" : "output") as "input" | "output" | "project",
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
      }

      // Build a map of message id to message for reply lookups
      const messageMap = Object.fromEntries((msgs ?? []).map((m) => [m.id, m]))

      const enrichedMessages: Message[] = (msgs ?? []).map((m) => {
        // Look up the replied-to message if it exists
        let replyToMessage = null
        if (m.reply_to_message_id && messageMap[m.reply_to_message_id]) {
          const repliedMsg = messageMap[m.reply_to_message_id]
          replyToMessage = {
            id: repliedMsg.id,
            content: repliedMsg.content,
            sender_name: profileMap[repliedMsg.sender_id] || "Unknown",
          }
        }

        return {
          ...m,
          sender_name: profileMap[m.sender_id] || "Unknown",
          key_results: messageKeyResultsMap[m.id] || [],
          journal_entries: messageJournalEntriesMap[m.id] || [],
          reply_to_message: replyToMessage,
        }
      })

      setMessages(enrichedMessages)
    } catch (err) {
      console.error("Error fetching messages:", err)
    }
  }, [activeClient.journals])

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
        reply_to_message_id: replyToMessage?.id || null,
      }).select("id").single()

      if (error) throw error

      // Insert key results into junction tables
      if (selectedKeyResults.length > 0 && newMsg) {
        const okrItems = selectedKeyResults.filter((kr) => kr.source !== "standard")
        const standardItems = selectedKeyResults.filter((kr) => kr.source === "standard")

        if (okrItems.length > 0) {
          const keyResultInserts = okrItems.map((kr) => ({
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

        if (standardItems.length > 0) {
          const standardInserts = standardItems.map((g) => ({
            message_id: newMsg.id,
            standard_goal_id: g.id,
          }))

          const { error: sgError } = await supabase
            .from("message_standard_goals")
            .insert(standardInserts)

          if (sgError) {
            console.error("Error inserting standard goals:", sgError)
          }
        }
      }

      // Insert journal attachments (period-based). `je.id` is the journal_id
      // under the new model — see JournalEntryDisplay.
      if (selectedJournalEntries.length > 0 && newMsg) {
        const journalInserts = selectedJournalEntries.map((je) => ({
          message_id: newMsg.id,
          journal_id: je.id,
          period_key: je.periodKey,
        }))

        const { error: jeError } = await supabase
          .from("message_journal_attachments")
          .insert(journalInserts)

        if (jeError) {
          console.error("Error inserting journal attachments:", jeError)
        }
      }

      setNewMessage("")
      setSelectedKeyResults([])
      setSelectedJournalEntries([])
      setReplyToMessage(null)
      
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
    if (!selectedTab || !activeClient.id || !currentUser.id) return
    
    setCreatingConversation(true)
    const supabase = createClient()

    try {
      // Determine coach_id and member_id based on current user's role
      const coachId = isCoachOrAdmin(currentUser.role) ? currentUser.id : selectedTab.supabaseUserId
      const memberId = !isCoachOrAdmin(currentUser.role) ? currentUser.id : selectedTab.supabaseUserId

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

      const finalCoachId = isCoachOrAdmin(currentUser.role) ? currentUser.id : otherUserId
      const finalMemberId = !isCoachOrAdmin(currentUser.role) ? currentUser.id : otherUserId

      const { data: newConvo, error } = await supabase
        .from("conversations")
        .insert({
          client_id: activeClient.id,
          coach_id: finalCoachId,
          member_id: finalMemberId,
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
                        "group flex items-start gap-2",
                        isOwnMessage ? "flex-row-reverse" : "flex-row"
                      )}
                    >
                      <div
                        className={cn(
                          "flex flex-col max-w-[85%]",
                          isOwnMessage ? "items-end" : "items-start"
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
                          {/* Reply Quote */}
                          {message.reply_to_message && (
                            <div
                              className={cn(
                                "mb-2 rounded-lg border-l-2 pl-2 py-1",
                                isOwnMessage
                                  ? "border-primary-foreground/50 bg-primary-foreground/10"
                                  : "border-primary bg-background/50"
                              )}
                            >
                              <p className={cn(
                                "text-xs font-medium",
                                isOwnMessage ? "text-primary-foreground" : "text-primary"
                              )}>
                                {message.reply_to_message.sender_name}
                              </p>
                              <p className={cn(
                                "text-xs line-clamp-2",
                                isOwnMessage ? "text-primary-foreground/70" : "text-muted-foreground"
                              )}>
                                {message.reply_to_message.content}
                              </p>
                            </div>
                          )}
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
                                  {typeConfig[kr.type].label} · Target {kr.target}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Attached Journal Entries */}
                        {message.journal_entries && message.journal_entries.length > 0 && (
                          <div className="mt-2 flex flex-col gap-2">
                            {message.journal_entries.map((je) => {
                              const hasContent = je.content.trim().length > 0
                              return (
                                <button
                                  key={je.id}
                                  type="button"
                                  onClick={() =>
                                    setPendingJournalNav({ journalId: je.id, periodKey: je.periodKey })
                                  }
                                  className={cn(
                                    "rounded-lg border p-3 text-left transition-colors",
                                    isOwnMessage
                                      ? "border-primary-foreground/20 bg-primary-foreground/10 hover:bg-primary-foreground/20"
                                      : "border-border bg-background/50 hover:bg-background/80"
                                  )}
                                >
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <BookOpen className={cn(
                                      "h-3.5 w-3.5",
                                      isOwnMessage ? "text-primary-foreground/70" : "text-muted-foreground"
                                    )} />
                                    <p className={cn(
                                      "text-xs font-medium",
                                      isOwnMessage ? "text-primary-foreground/70" : "text-muted-foreground"
                                    )}>
                                      {je.journalTitle} · {formatPeriodKey(je.periodKey, je.frequency as GoalFrequency)}
                                    </p>
                                  </div>
                                  {hasContent ? (
                                    <p className={cn(
                                      "text-sm line-clamp-3 whitespace-pre-wrap",
                                      isOwnMessage ? "text-primary-foreground" : "text-foreground"
                                    )}>
                                      {je.content}
                                    </p>
                                  ) : viewerIsCoach ? (
                                    <p className={cn(
                                      "text-sm italic",
                                      isOwnMessage ? "text-primary-foreground/60" : "text-muted-foreground"
                                    )}>
                                      No entry yet
                                    </p>
                                  ) : (
                                    <p className={cn(
                                      "text-sm font-medium",
                                      isOwnMessage ? "text-primary-foreground" : "text-primary"
                                    )}>
                                      Tap to start journaling →
                                    </p>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        )}
                        </div>
                        <span className="mt-1 px-2 text-[10px] text-muted-foreground">
                          {formatTime(message.created_at)}
                        </span>
                      </div>
                      {/* Reply button - appears on hover */}
                      <button
                        onClick={() => {
                          setReplyToMessage(message)
                          inputRef.current?.focus()
                        }}
                        className={cn(
                          "opacity-0 group-hover:opacity-100 transition-opacity",
                          "mt-2 p-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground"
                        )}
                        title="Reply"
                      >
                        <Reply className="h-4 w-4" />
                      </button>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Bottom section - reply preview + selected goals + input */}
      <div className="shrink-0">
        {/* Reply Preview */}
        {replyToMessage && (
          <div className="border-t border-border bg-secondary/30 px-4 py-2">
            <div className="flex items-start gap-3">
              <div className="flex-1 border-l-2 border-primary pl-3">
                <p className="text-xs font-medium text-primary">
                  {replyToMessage.sender_name}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {replyToMessage.content}
                </p>
              </div>
              <button
                onClick={() => setReplyToMessage(null)}
                className="p-1 rounded-full hover:bg-background/50 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
        
        {/* Selected Goals & Journal Entries Preview */}
        {(selectedKeyResults.length > 0 || selectedJournalEntries.length > 0) && (
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
              {selectedJournalEntries.map((je) => (
                <div
                  key={je.id}
                  className="flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1"
                >
                  <BookOpen className="h-3 w-3 text-primary" />
                  <span className="max-w-[150px] truncate text-xs text-foreground">
                    {je.journalTitle}
                  </span>
                  <button
                    onClick={() =>
                      setSelectedJournalEntries((prev) =>
                        prev.filter((j) => j.id !== je.id)
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
            <DialogTitle>Attach Goals & Journal Entries</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="flex flex-col gap-2 pr-4">
              {/* Goals section */}
              {allKeyResults.length > 0 && (
                <>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider pt-1">Goals</p>
                  {allKeyResults.map((kr) => {
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
                  })}
                </>
              )}

              {/* Journal entries section */}
              {journalEntryOptions.length > 0 && (
                <>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider pt-3">Journal Entries</p>
                  {journalEntryOptions.map((je) => {
                    const isSelected = selectedJournalEntries.some((j) => j.id === je.id)
                    return (
                      <button
                        key={je.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedJournalEntries((prev) =>
                              prev.filter((j) => j.id !== je.id)
                            )
                          } else {
                            setSelectedJournalEntries((prev) => [...prev, je])
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
                          <div className="mt-0.5 rounded p-1 bg-chart-4/10">
                            <BookOpen className="h-3 w-3 text-chart-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground">{je.journalTitle}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {getJournalFrequencyLabel(je.frequency as any)} · {formatPeriodKey(je.periodKey, je.frequency as GoalFrequency)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground/70 line-clamp-2">
                              {je.content}
                            </p>
                          </div>
                          {isSelected && (
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                              <Check className="h-3 w-3 text-primary-foreground" />
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </>
              )}

              {allKeyResults.length === 0 && journalEntryOptions.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No goals or journal entries available to attach.
                </p>
              )}
            </div>
          </ScrollArea>
          {(selectedKeyResults.length > 0 || selectedJournalEntries.length > 0) && (
            <div className="flex justify-end border-t pt-4">
              <Button onClick={() => {
                setGoalPickerOpen(false)
                inputRef.current?.focus()
              }}>
                Done ({selectedKeyResults.length + selectedJournalEntries.length} selected)
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
