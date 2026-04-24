"use client"

import { useState } from "react"
import { useApp } from "@/lib/store"
import { isCoachOrAdmin } from "@/lib/mock-data"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { hasFeature } from "@/lib/mock-data"
import { AlertTriangle, Building2, Pencil, Trash2, UserPlus, Mail, Globe, Users, Target } from "lucide-react"
import { cn } from "@/lib/utils"
import { InvitationsManager } from "./invitations-manager"
import { createClient } from "@/lib/supabase/client"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Common timezones for scheduling
const TIMEZONES = [
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time" },
  { value: "Pacific/Honolulu", label: "Hawaii Time" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Paris (CET/CEST)" },
  { value: "Europe/Berlin", label: "Berlin (CET/CEST)" },
  { value: "Europe/Amsterdam", label: "Amsterdam (CET/CEST)" },
  { value: "Europe/Madrid", label: "Madrid (CET/CEST)" },
  { value: "Europe/Rome", label: "Rome (CET/CEST)" },
  { value: "Europe/Stockholm", label: "Stockholm (CET/CEST)" },
  { value: "Europe/Zurich", label: "Zurich (CET/CEST)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Asia/Hong_Kong", label: "Hong Kong (HKT)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
  { value: "Australia/Melbourne", label: "Melbourne (AEST/AEDT)" },
  { value: "Pacific/Auckland", label: "Auckland (NZST/NZDT)" },
]

export function ClientSettings() {
  const {
    activeClient,
    companies,
    currentUser,
    updateClientName,
    updateMember,
    removeMember,
    deleteClient,
    updateClientFeatures,
  } = useApp()

  const isCoach = isCoachOrAdmin(currentUser.role)

  const [clientName, setClientName] = useState(activeClient.name)
  const [nameEditing, setNameEditing] = useState(false)
  const [timezone, setTimezone] = useState(activeClient.timezone || "UTC")
  const [savingTimezone, setSavingTimezone] = useState(false)

  // Member dialog state
  const [memberDialog, setMemberDialog] = useState<{
    open: boolean
    mode: "edit"
    memberId?: string
    name: string
    role: string
    emails: string[]
    emailInput: string
    userEmail?: string
  }>({ open: false, mode: "edit", name: "", role: "", emails: [], emailInput: "", userEmail: undefined })

  // Confirm delete member state
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Confirm delete coach state
  const [deleteCoachConfirm, setDeleteCoachConfirm] = useState<string | null>(null)

  // Danger zone: delete client
  const [deleteClientDialog, setDeleteClientDialog] = useState(false)
  const [deleteClientConfirm, setDeleteClientConfirm] = useState("")
  const [deletingClient, setDeletingClient] = useState(false)

  async function handleDeleteClient() {
    if (deleteClientConfirm !== activeClient.name) return
    setDeletingClient(true)
    await deleteClient(activeClient.id)
    setDeletingClient(false)
    setDeleteClientDialog(false)
    setDeleteClientConfirm("")
  }

  function handleSaveName() {
    const trimmed = clientName.trim()
    if (trimmed && trimmed !== activeClient.name) {
      updateClientName(trimmed)
    }
    setNameEditing(false)
  }

  async function handleTimezoneChange(newTimezone: string) {
    setTimezone(newTimezone)
    setSavingTimezone(true)
    
    try {
      const supabase = createClient()
      await supabase
        .from("clients")
        .update({ timezone: newTimezone })
        .eq("id", activeClient.id)
    } catch (err) {
      console.error("Error saving timezone:", err)
      // Revert on error
      setTimezone(activeClient.timezone || "UTC")
    } finally {
      setSavingTimezone(false)
    }
  }

  function openEditMember(member: { id: string; name: string; role: string; emails?: string[]; userEmail?: string }) {
    setMemberDialog({
      open: true,
      mode: "edit",
      memberId: member.id,
      name: member.name,
      role: member.role,
      emails: member.emails || [],
      emailInput: "",
      userEmail: member.userEmail,
    })
  }

  function handleSaveMember() {
    const name = memberDialog.name.trim()
    const role = memberDialog.role.trim()
    if (!name || !memberDialog.memberId) return

    // Auto-add any email that's still in the input field
    let emailsToSave = [...memberDialog.emails]
    const pendingEmail = memberDialog.emailInput.trim()
    if (pendingEmail && !emailsToSave.includes(pendingEmail)) {
      emailsToSave.push(pendingEmail)
    }

    updateMember(memberDialog.memberId, name, role, emailsToSave)
    setMemberDialog({ open: false, mode: "edit", name: "", role: "", emails: [], emailInput: "", userEmail: undefined })
  }

  function addEmail() {
    const email = memberDialog.emailInput.trim()
    if (email && !memberDialog.emails.includes(email)) {
      setMemberDialog((prev) => ({
        ...prev,
        emails: [...prev.emails, email],
        emailInput: "",
      }))
    }
  }

  function removeEmail(email: string) {
    setMemberDialog((prev) => ({
      ...prev,
      emails: prev.emails.filter((e) => e !== email),
    }))
  }

  function handleDeleteMember(id: string) {
    removeMember(id)
    setDeleteConfirm(null)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage client details and team members
        </p>
      </div>

      {/* Client Name */}
      <section className="mb-10 rounded-xl border border-border bg-card p-4 md:p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
            <Building2 className="h-4 w-4 text-foreground" />
          </div>
          <h2 className="text-base font-semibold text-foreground">Client</h2>
        </div>

        <div className="flex flex-col gap-3">
          <Label htmlFor="client-name" className="text-sm">
            Client name
          </Label>
          {nameEditing ? (
            <div className="flex items-center gap-2">
              <Input
                id="client-name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName()
                  if (e.key === "Escape") {
                    setClientName(activeClient.name)
                    setNameEditing(false)
                  }
                }}
                autoFocus
                className="max-w-sm"
              />
              <Button size="sm" onClick={handleSaveName}>
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setClientName(activeClient.name)
                  setNameEditing(false)
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium text-foreground">
                {activeClient.name}
              </p>
              {isCoach && (
                <button
                  onClick={() => {
                    setClientName(activeClient.name)
                    setNameEditing(true)
                  }}
                  className="rounded-md p-1 text-faint-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  title="Edit client name"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Timezone */}
      <section className="mb-10 rounded-xl border border-border bg-card p-4 md:p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
            <Globe className="h-4 w-4 text-foreground" />
          </div>
          <h2 className="text-base font-semibold text-foreground">Timezone</h2>
        </div>

        <div className="flex flex-col gap-3">
          <Label htmlFor="company-timezone" className="text-sm">
            Timezone for automations and scheduled messages
          </Label>
          <div className="flex items-center gap-3">
            <Select value={timezone} onValueChange={handleTimezoneChange} disabled={savingTimezone}>
              <SelectTrigger id="company-timezone" className="w-full max-w-sm">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {savingTimezone && (
              <span className="text-xs text-muted-foreground">Saving...</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            This timezone is used for scheduling automated messages and recurring tasks.
          </p>
        </div>
      </section>

      {/* Features (super admin only) */}
      {currentUser.role === "super_admin" && (
        <section className="mb-10 rounded-xl border border-border bg-card p-4 md:p-6">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
              <Target className="h-4 w-4 text-foreground" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Features</h2>
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Enable or disable optional features for this client.
            </p>

            {[
              { key: "okr", label: "OKR (Objectives & Key Results)", description: "Yearly objectives with quarterly key results and weekly tracking" },
              { key: "standard-goals", label: "Standard Goal Boards", description: "Custom goal boards with per-period tracking (non-OKR)" },
              { key: "metrics", label: "Monthly Metrics", description: "Track monthly metrics and KPIs" },
              { key: "meetings", label: "Meetings", description: "Meeting scheduling, notes, and Google Calendar sync" },
              { key: "journals", label: "Journals", description: "Periodic reflection prompts and journal entries" },
              { key: "automations", label: "Automations", description: "Automated check-ins and reminders" },
            ].map((feat) => (
              <label key={feat.key} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-secondary/50 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasFeature(activeClient, feat.key)}
                  onChange={(e) => {
                    const current = activeClient.features ?? []
                    const updated = e.target.checked
                      ? [...current, feat.key]
                      : current.filter((f) => f !== feat.key)
                    updateClientFeatures(updated)
                  }}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">{feat.label}</p>
                  <p className="text-xs text-muted-foreground">{feat.description}</p>
                </div>
              </label>
            ))}
          </div>
        </section>
      )}

      {/* Members */}
      <section className="rounded-xl border border-border bg-card p-4 md:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
              <UserPlus className="h-4 w-4 text-foreground" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Members</h2>
          </div>

        </div>

        {activeClient.members.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-10">
            <UserPlus className="mb-2 h-8 w-8 text-faint-foreground" />
            <p className="text-sm text-muted-foreground">No members added yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Invite members using the invitations section below</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {activeClient.members.map((member) => {
              const initials = member.name.split(" ").map((n) => n[0]).join("")
              return (
                <div
                  key={member.id}
                  className="group flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-secondary/50"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      {member.avatar && (
                        <AvatarImage src={member.avatar} alt={member.name} />
                      )}
                      <AvatarFallback className="bg-secondary text-xs font-medium text-foreground">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {member.name}
                      </p>
                      {member.role && (
                        <p className="text-xs text-muted-foreground">{member.role}</p>
                      )}
                    </div>
                  </div>

                  {isCoach && (
                    <div className="flex items-center gap-1 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
                      <button
                        onClick={() => openEditMember(member)}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        title="Edit member"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {deleteConfirm === member.id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-xs"
                            onClick={() => handleDeleteMember(member.id)}
                          >
                            Remove
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => setDeleteConfirm(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(member.id)}
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          title="Remove member"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Coaches */}
      <section className="mt-6 rounded-xl border border-border bg-card p-4 md:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
              <Users className="h-4 w-4 text-foreground" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Coaches</h2>
          </div>
        </div>

        {(() => {
          const coaches = activeClient.allMembers?.filter((m) => m.role === "coach") ?? []
          if (coaches.length === 0) {
            return (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-10">
                <Users className="mb-2 h-8 w-8 text-faint-foreground" />
                <p className="text-sm text-muted-foreground">No coaches added yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Invite coaches using the invitations section below</p>
              </div>
            )
          }
          return (
            <div className="flex flex-col gap-1">
              {coaches.map((coach) => {
                const initials = coach.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
                return (
                  <div
                    key={coach.id}
                    className="group flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-secondary/50"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        {coach.avatar && (
                          <AvatarImage src={coach.avatar} alt={coach.name} />
                        )}
                        <AvatarFallback className="bg-secondary text-xs font-medium text-foreground">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {coach.name}
                        </p>
                        {coach.roleTitle && (
                          <p className="text-xs text-muted-foreground">{coach.roleTitle}</p>
                        )}
                        {coach.email && (
                          <p className="text-xs text-muted-foreground">{coach.email}</p>
                        )}
                      </div>
                    </div>

                    {isCoach && (
                      <div className="flex items-center gap-1 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
                        {deleteCoachConfirm === coach.id ? (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 text-xs"
                              onClick={() => {
                                removeMember(coach.id)
                                setDeleteCoachConfirm(null)
                              }}
                            >
                              Remove
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => setDeleteCoachConfirm(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteCoachConfirm(coach.id)}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            title="Remove coach"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })()}
      </section>

      {/* Invitations Manager */}
      <InvitationsManager />

      {/* Danger Zone - coaches only */}
      {isCoach && <section className="mt-10 rounded-xl border border-destructive/30 bg-card p-4 md:p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          <h2 className="text-base font-semibold text-foreground">Danger Zone</h2>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Delete this client</p>
            <p className="text-xs text-muted-foreground">
              Permanently remove this client and all its data. This cannot be undone.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteClientDialog(true)}
          >
            Delete client
          </Button>
        </div>
      </section>}

      {/* Delete Client Confirmation Dialog */}
      <Dialog open={deleteClientDialog} onOpenChange={(open) => { if (!open) { setDeleteClientDialog(false); setDeleteClientConfirm("") } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {activeClient.name}?</DialogTitle>
            <DialogDescription>
              This will permanently delete the client, all goals, key results, metrics, and member data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="delete-confirm" className="text-sm">
                Type <span className="font-semibold text-foreground">{activeClient.name}</span> to confirm
              </Label>
              <Input
                id="delete-confirm"
                placeholder={activeClient.name}
                value={deleteClientConfirm}
                onChange={(e) => setDeleteClientConfirm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleDeleteClient()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteClientDialog(false); setDeleteClientConfirm("") }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteClient}
              disabled={deleteClientConfirm !== activeClient.name || deletingClient}
            >
              {deletingClient ? "Deleting..." : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Member Dialog */}
      <Dialog
        open={memberDialog.open}
        onOpenChange={(open) =>
          !open && setMemberDialog({ open: false, mode: "edit", name: "", role: "", emails: [], emailInput: "", userEmail: undefined })
        }
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Member</DialogTitle>
            <DialogDescription>
              {"Update this member's details and email addresses for meeting sync."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            {/* Connected user email */}
            {memberDialog.userEmail && (
              <div className="flex flex-col gap-2">
                <Label>Connected account</Label>
                <div className="flex items-center gap-2 rounded-md bg-secondary/50 px-3 py-2 text-sm text-foreground">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{memberDialog.userEmail}</span>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="member-name">Name</Label>
              <Input
                id="member-name"
                placeholder="Jane Smith"
                value={memberDialog.name}
                onChange={(e) =>
                  setMemberDialog((prev) => ({ ...prev, name: e.target.value }))
                }
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="member-role">Role</Label>
              <Input
                id="member-role"
                placeholder="CEO, CTO, COO..."
                value={memberDialog.role}
                onChange={(e) =>
                  setMemberDialog((prev) => ({ ...prev, role: e.target.value }))
                }
                onKeyDown={(e) => e.key === "Enter" && handleSaveMember()}
              />
            </div>

            {/* Email addresses section */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="member-email">Email addresses for meeting sync</Label>
              <div className="flex gap-2">
                <Input
                  id="member-email"
                  placeholder="name@example.com"
                  value={memberDialog.emailInput}
                  onChange={(e) =>
                    setMemberDialog((prev) => ({ ...prev, emailInput: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addEmail()
                    }
                  }}
                  type="email"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addEmail}
                  disabled={!memberDialog.emailInput.trim()}
                >
                  Add
                </Button>
              </div>

              {/* List of added emails */}
              {memberDialog.emails.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {memberDialog.emails.map((email) => (
                    <div
                      key={email}
                      className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary"
                    >
                      <span>{email}</span>
                      <button
                        onClick={() => removeEmail(email)}
                        className="ml-1 font-semibold hover:text-primary/80"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {memberDialog.emails.length === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  No emails added. Add email addresses to match meetings from Google Calendar.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setMemberDialog({ open: false, mode: "edit", name: "", role: "", emails: [], emailInput: "", userEmail: undefined })
              }
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveMember}
              disabled={!memberDialog.name.trim()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
