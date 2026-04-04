"use client"

import { useState, useEffect, useCallback } from "react"
import { useApp } from "@/lib/store"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import {
  Zap,
  Plus,
  Clock,
  CalendarIcon,
  Target,
  X,
  ArrowUpRight,
  ArrowDownRight,
  FolderKanban,
  Trash2,
  Pencil,
  Users,
  User,
  Send,
  MessageSquare,
  Play,
  Loader2,
} from "lucide-react"

// Types
interface Automation {
  id: string
  company_id: string
  coach_id: string
  type: "recurring" | "scheduled"
  name: string
  message_content: string
  is_active: boolean
  created_at: string
  recurring_config?: {
    frequency: "daily" | "weekly" | "monthly"
    day_of_week?: number
    day_of_month?: number
    time_of_day: string
  }

  scheduled_config?: {
    scheduled_at: string
    conversation_id: string
    conversation_name?: string
  }
  key_results?: { id: string; title: string; type: string; target: number }[]
  founders?: { member_id: string; name: string }[]
  conversations?: { id: string; name: string; is_group: boolean }[]
}

interface ConversationOption {
  id: string
  name: string
  is_group: boolean
}

interface FounderOption {
  id: string // company_member id
  name: string
}

interface KeyResultOption {
  id: string
  title: string
  type: "input" | "output" | "project"
  target: number
  goalObjective: string
  owner: string | null
}

const typeConfig = {
  input: {
    label: "INPUT",
    icon: ArrowUpRight,
    color: "text-chart-2",
    bgColor: "bg-chart-2/10",
  },
  output: {
    label: "OUTPUT",
    icon: ArrowDownRight,
    color: "text-chart-1",
    bgColor: "bg-chart-1/10",
  },
  project: {
    label: "PROJECT",
    icon: FolderKanban,
    color: "text-chart-3",
    bgColor: "bg-chart-3/10",
  },
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
]

export function AutomationsSection() {
  const { activeCompany, currentUser } = useApp()
  const [automations, setAutomations] = useState<Automation[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Dialog state
  const [typePickerOpen, setTypePickerOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create")
  const [selectedType, setSelectedType] = useState<"recurring" | "scheduled" | null>(null)
  const [goalPickerOpen, setGoalPickerOpen] = useState(false)

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    message_content: "",
    // Recurring
    frequency: "weekly" as "daily" | "weekly" | "monthly",
    day_of_week: 1,
    day_of_month: 1,
    time_of_day: "09:00",
    // Meeting trigger

    // Scheduled
    scheduled_date: "",
    scheduled_time: "09:00",
    conversation_id: "",
  })
  const [selectedKeyResults, setSelectedKeyResults] = useState<KeyResultOption[]>([])
  const [selectedFounders, setSelectedFounders] = useState<FounderOption[]>([])
  const [selectedConversations, setSelectedConversations] = useState<ConversationOption[]>([])
  const [conversations, setConversations] = useState<ConversationOption[]>([])
  const [testingId, setTestingId] = useState<string | null>(null)

  // Get all key results from the active company
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

  // Get all founders from the active company
  const allFounders: FounderOption[] = (activeCompany.members || [])
    .filter((m) => m.role === "founder")
    .map((m) => ({ id: m.id, name: m.name }))

  // Fetch conversations for the company
  const fetchConversations = useCallback(async () => {
    if (!activeCompany.id) return
    
    const supabase = createClient()
    
    try {
      const { data: convos, error } = await supabase
        .from("conversations")
        .select("id, name, is_group, coach_id, founder_id")
        .eq("company_id", activeCompany.id)
      
      if (error) throw error
      
      // For 1:1 chats, get founder names by looking up the user_id in company_members
      const { data: members } = await supabase
        .from("company_members")
        .select("user_id, name")
        .eq("company_id", activeCompany.id)
        .eq("role", "founder")
      
      // Build a lookup map from user_id to name
      const userIdToName = new Map<string, string>()
      for (const m of members ?? []) {
        if (m.user_id) {
          userIdToName.set(m.user_id, m.name)
        }
      }
      
      // Build conversation options with names
      const options: ConversationOption[] = (convos ?? []).map((c) => {
        let name = c.name || "Unknown"
        if (!c.is_group && c.founder_id) {
          // For 1:1 chats, find the founder name via user_id
          name = userIdToName.get(c.founder_id) || "1:1 Chat"
        }
        return {
          id: c.id,
          name: c.is_group ? `${name} (Group)` : name,
          is_group: c.is_group,
        }
      })
      
      setConversations(options)
    } catch (err) {
      console.error("Error fetching conversations:", err)
    }
  }, [activeCompany.id])

  // Fetch automations
  const fetchAutomations = useCallback(async () => {
    if (!activeCompany.id) return
    
    const supabase = createClient()
    setLoading(true)

    try {
      // Fetch automations
      const { data: autos, error } = await supabase
        .from("automations")
        .select("*")
        .eq("company_id", activeCompany.id)
        .order("created_at", { ascending: false })

      if (error) throw error

      // Fetch configs for each automation
      const enrichedAutomations: Automation[] = []
      
      for (const auto of (autos ?? [])) {
        let recurring_config = undefined

        let scheduled_config = undefined
        let key_results: { id: string; title: string; type: string; target: number }[] = []

        if (auto.type === "recurring") {
          const { data: rc } = await supabase
            .from("automation_recurring_config")
            .select("*")
            .eq("automation_id", auto.id)
            .single()
          recurring_config = rc || undefined
        } else if (auto.type === "scheduled") {
          const { data: sc } = await supabase
            .from("automation_scheduled_config")
            .select("*, conversations(name, is_group, founder_id)")
            .eq("automation_id", auto.id)
            .single()
          if (sc) {
            let convoName = "Chat"
            if (sc.conversations?.is_group) {
              convoName = sc.conversations?.name || "Group Chat"
            } else if (sc.conversations?.founder_id) {
              // For 1:1 chats, fetch the founder's name
              const { data: founder } = await supabase
                .from("profiles")
                .select("full_name")
                .eq("id", sc.conversations.founder_id)
                .single()
              convoName = founder?.full_name || "Founder"
            }
            scheduled_config = {
              scheduled_at: sc.scheduled_at,
              conversation_id: sc.conversation_id,
              conversation_name: convoName,
            }
          }
        }

        // Fetch key results
        const { data: akrs } = await supabase
          .from("automation_key_results")
          .select("quarterly_key_result_id")
          .eq("automation_id", auto.id)

        if (akrs && akrs.length > 0) {
          const krIds = akrs.map((akr) => akr.quarterly_key_result_id)
          const { data: krs } = await supabase
            .from("quarterly_key_results")
            .select("id, title, type, target, owner")
            .in("id", krIds)
          key_results = krs || []
        }

        // Fetch founders
        let founders: { member_id: string; name: string }[] = []
        const { data: afs, error: afsError } = await supabase
          .from("automation_founders")
          .select("founder_member_id")
          .eq("automation_id", auto.id)

        if (afs && afs.length > 0) {
          const memberIds = afs.map((af) => af.founder_member_id)
          const { data: members } = await supabase
            .from("company_members")
            .select("id, name")
            .in("id", memberIds)
          founders = (members || []).map((m) => ({ member_id: m.id, name: m.name }))
        }

        // Fetch conversations linked to this automation
        let linkedConversations: { id: string; name: string; is_group: boolean }[] = []
        const { data: acs, error: acsError } = await supabase
          .from("automation_conversations")
          .select("conversation_id, conversations(id, name, is_group, founder_id)")
          .eq("automation_id", auto.id)

        if (acs && acs.length > 0) {
          // For 1:1 chats, we need to fetch the founder names
          const conversationsWithFounders = await Promise.all(
            acs.map(async (ac) => {
              const c = ac.conversations as { id: string; name: string | null; is_group: boolean; founder_id: string | null } | null
              let displayName = c?.name || "Chat"
              
              // For 1:1 chats, fetch the founder's name
              if (c && !c.is_group && c.founder_id) {
                const { data: founder } = await supabase
                  .from("profiles")
                  .select("full_name")
                  .eq("id", c.founder_id)
                  .single()
                displayName = founder?.full_name || "Founder"
              }
              
              return {
                id: c?.id || ac.conversation_id,
                name: displayName,
                is_group: c?.is_group || false,
              }
            })
          )
          linkedConversations = conversationsWithFounders
        }

        enrichedAutomations.push({
          ...auto,
          recurring_config,
          scheduled_config,
          key_results,
          founders,
          conversations: linkedConversations,
        })
      }

      setAutomations(enrichedAutomations)
    } catch (err) {
      console.error("Error fetching automations:", err)
    } finally {
      setLoading(false)
    }
  }, [activeCompany.id])

  useEffect(() => {
    fetchAutomations()
    fetchConversations()
  }, [fetchAutomations, fetchConversations])

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      message_content: "",
      frequency: "weekly",
      day_of_week: 1,
      day_of_month: 1,
      time_of_day: "09:00",

      scheduled_date: "",
      scheduled_time: "09:00",
      conversation_id: "",
    })
    setSelectedKeyResults([])
    setSelectedFounders([])
    setSelectedConversations([])
    setEditingId(null)
  }

  // Open type picker
  const openTypePicker = () => {
    resetForm()
    setTypePickerOpen(true)
  }

  // Select type and open editor
  const selectType = (type: "recurring" | "scheduled") => {
    setSelectedType(type)
    setEditorMode("create")
    setTypePickerOpen(false)
    setEditorOpen(true)
  }

  // Open editor for editing
  const openEditAutomation = (automation: Automation) => {
    setEditingId(automation.id)
    setSelectedType(automation.type)
    setEditorMode("edit")
    
    // Parse scheduled datetime if present
    let scheduled_date = ""
    let scheduled_time = "09:00"
    if (automation.scheduled_config?.scheduled_at) {
      const dt = new Date(automation.scheduled_config.scheduled_at)
      scheduled_date = dt.toISOString().split("T")[0]
      scheduled_time = dt.toTimeString().slice(0, 5)
    }
    
    // Parse time_of_day - database stores as '09:00:00' but UI uses '09:00'
    const dbTimeOfDay = automation.recurring_config?.time_of_day || "09:00"
    const timeOfDay = dbTimeOfDay.substring(0, 5) // Take first 5 chars (HH:MM)
    
    setFormData({
      name: automation.name,
      message_content: automation.message_content,
      frequency: automation.recurring_config?.frequency || "weekly",
      day_of_week: automation.recurring_config?.day_of_week ?? 1,
      day_of_month: automation.recurring_config?.day_of_month ?? 1,
      time_of_day: timeOfDay,

      scheduled_date,
      scheduled_time,
      conversation_id: automation.scheduled_config?.conversation_id || "",
    })

    // Map key results
    const krs = (automation.key_results || []).map((kr) => {
      const found = allKeyResults.find((akr) => akr.id === kr.id)
      return found || { ...kr, type: kr.type as "input" | "output" | "project", goalObjective: "" }
    })
    setSelectedKeyResults(krs as KeyResultOption[])

    // Map founders
    const fndrs = (automation.founders || []).map((f) => ({
      id: f.member_id,
      name: f.name,
    }))
    setSelectedFounders(fndrs)

    // Map conversations
    const convos = (automation.conversations || []).map((c) => ({
      id: c.id,
      name: c.name,
      is_group: c.is_group,
    }))
    setSelectedConversations(convos)

    setEditorOpen(true)
  }

  // Save automation
  const saveAutomation = async () => {
    if (!formData.message_content.trim() || !selectedType) return
    
    // Additional validation for scheduled type
    if (selectedType === "scheduled") {
      if (!formData.scheduled_date || !formData.conversation_id) return
    }
    
    // Validation for recurring - must have at least one conversation
    if (selectedType === "recurring") {
      if (selectedConversations.length === 0) return
    }

    const supabase = createClient()
    setSaving(true)

    try {
      const autoName = formData.name.trim() || generateDefaultName()

      if (editorMode === "create") {
        // Create automation
        const { data: newAuto, error: autoError } = await supabase
          .from("automations")
          .insert({
            company_id: activeCompany.id,
            coach_id: currentUser.id,
            type: selectedType,
            name: autoName,
            message_content: formData.message_content.trim(),
            is_active: true,
          })
          .select()
          .single()

        if (autoError) throw autoError

        // Create config
        if (selectedType === "recurring") {
          const { error: rcError } = await supabase
            .from("automation_recurring_config")
            .insert({
              automation_id: newAuto.id,
              frequency: formData.frequency,
              day_of_week: formData.frequency === "weekly" ? formData.day_of_week : null,
              day_of_month: formData.frequency === "monthly" ? formData.day_of_month : null,
              time_of_day: formData.time_of_day,
            })
          if (rcError) throw rcError
        } else if (selectedType === "scheduled") {
          // Combine date and time into a timestamp
          const scheduledAt = new Date(`${formData.scheduled_date}T${formData.scheduled_time}:00`)
          const { error: scError } = await supabase
            .from("automation_scheduled_config")
            .insert({
              automation_id: newAuto.id,
              conversation_id: formData.conversation_id,
              scheduled_at: scheduledAt.toISOString(),
            })
          if (scError) throw scError
        }

        // Create key result associations
        if (selectedKeyResults.length > 0) {
          const inserts = selectedKeyResults.map((kr) => ({
            automation_id: newAuto.id,
            quarterly_key_result_id: kr.id,
          }))
          await supabase.from("automation_key_results").insert(inserts)
        }

        // Create founder associations
        if (selectedFounders.length > 0) {
          const founderInserts = selectedFounders.map((f) => ({
            automation_id: newAuto.id,
            founder_member_id: f.id,
          }))
          await supabase.from("automation_founders").insert(founderInserts)
        }

        // Create conversation associations (for recurring messages)
        if (selectedConversations.length > 0) {
          const convoInserts = selectedConversations.map((c) => ({
            automation_id: newAuto.id,
            conversation_id: c.id,
          }))
          await supabase.from("automation_conversations").insert(convoInserts)
        }
      } else {
        // Update automation
        const { error: autoError } = await supabase
          .from("automations")
          .update({
            name: autoName,
            message_content: formData.message_content.trim(),
          })
          .eq("id", editingId)

        if (autoError) throw autoError

        // Update config
        if (selectedType === "recurring") {
          await supabase
            .from("automation_recurring_config")
            .update({
              frequency: formData.frequency,
              day_of_week: formData.frequency === "weekly" ? formData.day_of_week : null,
              day_of_month: formData.frequency === "monthly" ? formData.day_of_month : null,
              time_of_day: formData.time_of_day,
            })
            .eq("automation_id", editingId)
        } else if (selectedType === "scheduled") {
          // Build scheduled_at from date and time
          const scheduledAt = new Date(`${formData.scheduled_date}T${formData.scheduled_time}`)
          await supabase
            .from("automation_scheduled_config")
            .update({
              scheduled_at: scheduledAt.toISOString(),
              conversation_id: selectedConversations[0]?.id || null,
              executed: false, // Reset executed flag when editing
            })
            .eq("automation_id", editingId)
        }

        // Update key results - delete and re-insert
        await supabase.from("automation_key_results").delete().eq("automation_id", editingId)
        if (selectedKeyResults.length > 0) {
          const inserts = selectedKeyResults.map((kr) => ({
            automation_id: editingId,
            quarterly_key_result_id: kr.id,
          }))
          await supabase.from("automation_key_results").insert(inserts)
        }

        // Update founders - delete and re-insert
        await supabase.from("automation_founders").delete().eq("automation_id", editingId)
        if (selectedFounders.length > 0) {
          const founderInserts = selectedFounders.map((f) => ({
            automation_id: editingId,
            founder_member_id: f.id,
          }))
          await supabase.from("automation_founders").insert(founderInserts)
        }

        // Update conversations - delete and re-insert
        await supabase.from("automation_conversations").delete().eq("automation_id", editingId)
        if (selectedConversations.length > 0) {
          const convoInserts = selectedConversations.map((c) => ({
            automation_id: editingId,
            conversation_id: c.id,
          }))
          await supabase.from("automation_conversations").insert(convoInserts)
        }
      }

      setEditorOpen(false)
      resetForm()
      fetchAutomations()
    } catch (err) {
      console.error("Error saving automation:", err)
    } finally {
      setSaving(false)
    }
  }

  // Toggle automation active state
  const toggleActive = async (automationId: string, isActive: boolean) => {
    const supabase = createClient()
    
    try {
      await supabase
        .from("automations")
        .update({ is_active: isActive })
        .eq("id", automationId)

      setAutomations((prev) =>
        prev.map((a) => (a.id === automationId ? { ...a, is_active: isActive } : a))
      )
    } catch (err) {
      console.error("Error toggling automation:", err)
    }
  }

  // Delete automation
  const deleteAutomation = async (automationId: string) => {
    const supabase = createClient()
    
    try {
      await supabase.from("automations").delete().eq("id", automationId)
      setAutomations((prev) => prev.filter((a) => a.id !== automationId))
    } catch (err) {
      console.error("Error deleting automation:", err)
    }
  }

  // Test automation - send message immediately
  const testAutomation = async (automation: Automation) => {
    setTestingId(automation.id)
    
    try {
      const response = await fetch("/api/automations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ automationId: automation.id }),
      })
      
      const result = await response.json()
      
      if (result.success) {
        alert(`Message sent successfully to ${result.conversationCount || 1} conversation(s)!`)
      } else {
        alert(`Failed to send: ${result.error || "Unknown error"}`)
      }
    } catch (err) {
      console.error("Error testing automation:", err)
      alert("Failed to test automation. Check console for details.")
    } finally {
      setTestingId(null)
    }
  }

  // Generate default name
  const generateDefaultName = () => {
    if (selectedType === "recurring") {
      const day = DAYS_OF_WEEK.find((d) => d.value === formData.day_of_week)?.label || ""
      return `${formData.frequency === "weekly" ? `Weekly on ${day}` : formData.frequency === "daily" ? "Daily" : `Monthly on day ${formData.day_of_month}`}`
    }
    if (selectedType === "scheduled") {
      const convo = conversations.find((c) => c.id === formData.conversation_id)
      const dateStr = formData.scheduled_date ? new Date(formData.scheduled_date).toLocaleDateString() : "TBD"
      return `Scheduled for ${convo?.name || "chat"} on ${dateStr}`
    }

  }

  // Format time string (HH:MM) to readable format (e.g., "9:30 AM")
  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(":").map(Number)
    const ampm = hours >= 12 ? "PM" : "AM"
    const displayHour = hours % 12 || 12
    return `${displayHour}:${minutes.toString().padStart(2, "0")} ${ampm}`
  }

  // Format schedule description
  const formatSchedule = (auto: Automation) => {
    if (auto.type === "recurring" && auto.recurring_config) {
      const rc = auto.recurring_config
      const time = formatTime(rc.time_of_day.substring(0, 5))
      
      if (rc.frequency === "daily") {
        return `Every day at ${time}`
      } else if (rc.frequency === "weekly") {
        const day = DAYS_OF_WEEK.find((d) => d.value === rc.day_of_week)?.label || ""
        return `Every ${day} at ${time}`
      } else {
        return `Monthly on day ${rc.day_of_month} at ${time}`
      }
    } else if (auto.type === "scheduled" && auto.scheduled_config) {
      const sc = auto.scheduled_config
      const dt = new Date(sc.scheduled_at)
      const dateStr = dt.toLocaleDateString("en-US", { 
        month: "short", 
        day: "numeric",
        year: dt.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined 
      })
      const timeStr = dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      return `${dateStr} at ${timeStr} to ${sc.conversation_name}`
    }
    return ""
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
          <p className="text-sm text-muted-foreground">Loading automations...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Automations</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Set up automated messages to founders on a schedule or around meetings.
          </p>
        </div>
        <Button onClick={openTypePicker} className="gap-2">
          <Plus className="h-4 w-4" />
          New Automation
        </Button>
      </div>

      {/* Automations List */}
      {automations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <Zap className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm font-medium text-foreground">No automations yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Create your first automation to send scheduled messages to founders.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {automations.map((auto) => (
            <div
              key={auto.id}
              className={cn(
                "rounded-lg border p-4 transition-colors",
                auto.is_active ? "border-border bg-card" : "border-border/50 bg-card/50 opacity-60"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "rounded p-2",
                          auto.type === "recurring" ? "bg-chart-2/10" : "bg-chart-3/10"
                        )}
                      >
                        {auto.type === "recurring" ? (
                          <Clock className="h-4 w-4 text-chart-2" />
                        ) : (
                          <Send className="h-4 w-4 text-chart-3" />
                        )}
                      </div>
                      <h3 className="font-medium text-foreground">{auto.name}</h3>
                    </div>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {formatSchedule(auto)}
                    {auto.conversations && auto.conversations.length > 0 && (
                      <span> · to {auto.conversations.map((c) => c.name).join(", ")}</span>
                    )}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm text-foreground/80">
                    {auto.message_content}
                  </p>
                  {auto.key_results && auto.key_results.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {auto.key_results.map((kr) => {
                        if (!kr || !kr.type) return null
                        const config = typeConfig[kr.type as keyof typeof typeConfig]
                        if (!config) return null
                        return (
                          <span
                            key={kr.id}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
                              config.bgColor,
                              config.color
                            )}
                          >
                            <Target className="h-3 w-3" />
                            {kr.title}{kr.owner ? ` · ${kr.owner}` : ""}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-chart-2 hover:text-chart-2"
                    onClick={() => testAutomation(auto)}
                    disabled={testingId === auto.id}
                    title="Test - Send message now"
                  >
                    {testingId === auto.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEditAutomation(auto)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deleteAutomation(auto.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Switch
                    checked={auto.is_active}
                    onCheckedChange={(checked) => toggleActive(auto.id, checked)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Type Picker Dialog */}
      <Dialog open={typePickerOpen} onOpenChange={setTypePickerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Choose Automation Type</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <button
              onClick={() => selectType("recurring")}
              className="flex items-start gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:bg-secondary/50"
            >
              <div className="rounded bg-chart-2/10 p-2">
                <Clock className="h-5 w-5 text-chart-2" />
              </div>
              <div>
                <p className="font-medium text-foreground">Recurring Message</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Send messages on a regular schedule (daily, weekly, monthly)
                </p>
              </div>
            </button>

            <button
              onClick={() => selectType("scheduled")}
              className="flex items-start gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:bg-secondary/50"
            >
              <div className="rounded bg-chart-3/10 p-2">
                <Send className="h-5 w-5 text-chart-3" />
              </div>
              <div>
                <p className="font-medium text-foreground">Scheduled Message</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Schedule a single message to be sent at a specific date and time
                </p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={(open) => {
        if (!open) resetForm()
        setEditorOpen(open)
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editorMode === "create" ? "Create" : "Edit"}{" "}
              {selectedType === "recurring" ? "Recurring Message" : "Scheduled Message"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            {/* Name */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="auto-name">Name (optional)</Label>
              <Input
                id="auto-name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder={generateDefaultName()}
              />
            </div>

            {/* Recurring Config */}
            {selectedType === "recurring" && (
              <div className="flex flex-col gap-3">
                <Label>Schedule</Label>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Send a message every</span>
                  <Select
                    value={formData.frequency}
                    onValueChange={(v) => setFormData((prev) => ({ ...prev, frequency: v as typeof formData.frequency }))}
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Day</SelectItem>
                      <SelectItem value="weekly">Week</SelectItem>
                      <SelectItem value="monthly">Month</SelectItem>
                    </SelectContent>
                  </Select>

                  {formData.frequency === "weekly" && (
                    <>
                      <span className="text-muted-foreground">on</span>
                      <Select
                        value={formData.day_of_week.toString()}
                        onValueChange={(v) => setFormData((prev) => ({ ...prev, day_of_week: parseInt(v) }))}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAYS_OF_WEEK.map((d) => (
                            <SelectItem key={d.value} value={d.value.toString()}>
                              {d.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  )}

                  {formData.frequency === "monthly" && (
                    <>
                      <span className="text-muted-foreground">on day</span>
                      <Select
                        value={formData.day_of_month.toString()}
                        onValueChange={(v) => setFormData((prev) => ({ ...prev, day_of_month: parseInt(v) }))}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                            <SelectItem key={d} value={d.toString()}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  )}

                  <span className="text-muted-foreground">at</span>
                  <Input
                    type="time"
                    value={formData.time_of_day}
                    onChange={(e) => setFormData((prev) => ({ ...prev, time_of_day: e.target.value }))}
                    className="w-28"
                  />
                  <span className="text-muted-foreground">to</span>
                </div>

                {/* Conversation Selection */}
                <div className="mt-3 flex flex-col gap-2">
                  <Label className="text-xs text-muted-foreground">Send to:</Label>
                  {conversations.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No conversations available. Start a conversation first.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {conversations.map((convo) => {
                        const isSelected = selectedConversations.some((c) => c.id === convo.id)
                        return (
                          <button
                            key={convo.id}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setSelectedConversations((prev) => prev.filter((c) => c.id !== convo.id))
                              } else {
                                setSelectedConversations((prev) => [...prev, convo])
                              }
                            }}
                            className={cn(
                              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors",
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-foreground hover:bg-secondary/80"
                            )}
                          >
                            {convo.is_group ? (
                              <Users className="h-3 w-3" />
                            ) : (
                              <MessageSquare className="h-3 w-3" />
                            )}
                            {convo.name}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {selectedConversations.length === 0 && conversations.length > 0 && (
                    <p className="text-xs text-amber-500">Please select at least one chat</p>
                  )}
                </div>
              </div>
            )}

            {/* Scheduled Config */}
            {selectedType === "scheduled" && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label className="text-xs text-muted-foreground">Send to:</Label>
                  {conversations.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No conversations available. Start a conversation first.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {conversations.map((convo) => {
                        const isSelected = formData.conversation_id === convo.id
                        return (
                          <button
                            key={convo.id}
                            type="button"
                            onClick={() => {
                              setFormData((prev) => ({ ...prev, conversation_id: convo.id }))
                            }}
                            className={cn(
                              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors",
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-foreground hover:bg-secondary/80"
                            )}
                          >
                            {convo.is_group ? (
                              <Users className="h-3 w-3" />
                            ) : (
                              <MessageSquare className="h-3 w-3" />
                            )}
                            {convo.name}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {!formData.conversation_id && conversations.length > 0 && (
                    <p className="text-xs text-amber-500">Please select a chat</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <Label>Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "justify-start text-left font-normal",
                            !formData.scheduled_date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.scheduled_date ? (
                            format(new Date(formData.scheduled_date), "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={formData.scheduled_date ? new Date(formData.scheduled_date) : undefined}
                          onSelect={(date) => {
                            if (date) {
                              setFormData((prev) => ({
                                ...prev,
                                scheduled_date: format(date, "yyyy-MM-dd"),
                              }))
                            }
                          }}
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="scheduled-time">Time</Label>
                    <Input
                      id="scheduled-time"
                      type="time"
                      value={formData.scheduled_time}
                      onChange={(e) => setFormData((prev) => ({ ...prev, scheduled_time: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            )}
            
            {/* Message */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="auto-message">Message</Label>
              <Textarea
                id="auto-message"
                value={formData.message_content}
                onChange={(e) => setFormData((prev) => ({ ...prev, message_content: e.target.value }))}
                placeholder="Enter your message..."
                rows={4}
              />
            </div>

            {/* Attached Goals */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label>Attached Goals</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setGoalPickerOpen(true)}
                  className="gap-1.5 text-xs"
                >
                  <Plus className="h-3 w-3" />
                  Add Goal
                </Button>
              </div>
              {selectedKeyResults.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedKeyResults.map((kr) => {
                    const config = typeConfig[kr.type]
                    return (
                      <div
                        key={kr.id}
                        className="flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1"
                      >
                        <Target className={cn("h-3 w-3", config.color)} />
                        <span className="max-w-[120px] truncate text-xs text-foreground">
                          {kr.title}
                        </span>
                        <button
                          onClick={() =>
                            setSelectedKeyResults((prev) => prev.filter((k) => k.id !== kr.id))
                          }
                          className="ml-0.5 rounded-full p-0.5 hover:bg-background/50"
                        >
                          <X className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No goals attached</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
              <Button
                onClick={saveAutomation}
                disabled={
                  !formData.message_content.trim() ||
                  saving ||
                  (selectedType === "recurring" && selectedConversations.length === 0) ||
                  (selectedType === "scheduled" && (!formData.scheduled_date || !formData.conversation_id))
                }
              >
              {saving ? "Saving..." : editorMode === "create" ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  if (!kr || !kr.type) return null
                  const config = typeConfig[kr.type]
                  if (!config) return null
                  const TypeIcon = config.icon
                  const isSelected = selectedKeyResults.some((k) => k.id === kr.id)
                  return (
                    <button
                      key={kr.id}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedKeyResults((prev) => prev.filter((k) => k.id !== kr.id))
                        } else {
                          setSelectedKeyResults((prev) => [...prev, kr])
                        }
                      }}
                      className={cn(
                        "flex flex-col items-start rounded-lg border p-3 text-left transition-colors hover:bg-secondary/50",
                        isSelected ? "border-primary bg-primary/5" : "border-border"
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
              <Button onClick={() => setGoalPickerOpen(false)}>
                Done ({selectedKeyResults.length} selected)
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
