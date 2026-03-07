"use client"

import { useState } from "react"
import { useApp } from "@/lib/store"
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
import { AlertTriangle, Building2, Pencil, Trash2, UserPlus, Mail } from "lucide-react"
import { cn } from "@/lib/utils"
import { InvitationsManager } from "./invitations-manager"

export function CompanySettings() {
  const {
    activeCompany,
    companies,
    currentUser,
    updateCompanyName,
    updateFounder,
    removeFounder,
    deleteCompany,
  } = useApp()

  const isCoach = currentUser.role === "coach"

  const [companyName, setCompanyName] = useState(activeCompany.name)
  const [nameEditing, setNameEditing] = useState(false)

  // Founder dialog state
  const [founderDialog, setFounderDialog] = useState<{
    open: boolean
    mode: "edit"
    founderId?: string
    name: string
    role: string
    emails: string[]
    emailInput: string
  }>({ open: false, mode: "edit", name: "", role: "", emails: [], emailInput: "" })

  // Confirm delete founder state
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Danger zone: delete company
  const [deleteCompanyDialog, setDeleteCompanyDialog] = useState(false)
  const [deleteCompanyConfirm, setDeleteCompanyConfirm] = useState("")
  const [deletingCompany, setDeletingCompany] = useState(false)

  async function handleDeleteCompany() {
    if (deleteCompanyConfirm !== activeCompany.name) return
    setDeletingCompany(true)
    await deleteCompany(activeCompany.id)
    setDeletingCompany(false)
    setDeleteCompanyDialog(false)
    setDeleteCompanyConfirm("")
  }

  function handleSaveName() {
    const trimmed = companyName.trim()
    if (trimmed && trimmed !== activeCompany.name) {
      updateCompanyName(trimmed)
    }
    setNameEditing(false)
  }

  function openEditFounder(founder: { id: string; name: string; role: string; emails?: string[] }) {
    setFounderDialog({
      open: true,
      mode: "edit",
      founderId: founder.id,
      name: founder.name,
      role: founder.role,
      emails: founder.emails || [],
      emailInput: "",
    })
  }

  function handleSaveFounder() {
    const name = founderDialog.name.trim()
    const role = founderDialog.role.trim()
    if (!name || !founderDialog.founderId) return

    // Auto-add any email that's still in the input field
    let emailsToSave = [...founderDialog.emails]
    const pendingEmail = founderDialog.emailInput.trim()
    if (pendingEmail && !emailsToSave.includes(pendingEmail)) {
      emailsToSave.push(pendingEmail)
    }

    console.log("[v0] Saving founder with emails:", emailsToSave)
    updateFounder(founderDialog.founderId, name, role, emailsToSave)
    setFounderDialog({ open: false, mode: "edit", name: "", role: "", emails: [], emailInput: "" })
  }

  function addEmail() {
    const email = founderDialog.emailInput.trim()
    console.log("[v0] addEmail called:", { email, currentEmails: founderDialog.emails })
    if (email && !founderDialog.emails.includes(email)) {
      console.log("[v0] Adding email to list")
      setFounderDialog((prev) => ({
        ...prev,
        emails: [...prev.emails, email],
        emailInput: "",
      }))
    }
  }

  function removeEmail(email: string) {
    setFounderDialog((prev) => ({
      ...prev,
      emails: prev.emails.filter((e) => e !== email),
    }))
  }

  function handleDeleteFounder(id: string) {
    removeFounder(id)
    setDeleteConfirm(null)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage company details and team members
        </p>
      </div>

      {/* Company Name */}
      <section className="mb-10 rounded-xl border border-border bg-card p-4 md:p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
            <Building2 className="h-4 w-4 text-foreground" />
          </div>
          <h2 className="text-base font-semibold text-foreground">Company</h2>
        </div>

        <div className="flex flex-col gap-3">
          <Label htmlFor="company-name" className="text-sm text-muted-foreground">
            Company name
          </Label>
          {nameEditing ? (
            <div className="flex items-center gap-2">
              <Input
                id="company-name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName()
                  if (e.key === "Escape") {
                    setCompanyName(activeCompany.name)
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
                  setCompanyName(activeCompany.name)
                  setNameEditing(false)
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium text-foreground">
                {activeCompany.name}
              </p>
              {isCoach && (
                <button
                  onClick={() => {
                    setCompanyName(activeCompany.name)
                    setNameEditing(true)
                  }}
                  className="rounded-md p-1 text-muted-foreground/50 transition-colors hover:bg-secondary hover:text-foreground"
                  title="Edit company name"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Founders */}
      <section className="rounded-xl border border-border bg-card p-4 md:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
              <UserPlus className="h-4 w-4 text-foreground" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Founders</h2>
          </div>

        </div>

        {activeCompany.founders.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-10">
            <UserPlus className="mb-2 h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No founders added yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Invite founders using the invitations section below</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {activeCompany.founders.map((founder) => {
              const initials = founder.name.split(" ").map((n) => n[0]).join("")
              return (
                <div
                  key={founder.id}
                  className="group flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-secondary/50"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      {founder.avatar && (
                        <AvatarImage src={founder.avatar} alt={founder.name} />
                      )}
                      <AvatarFallback className="bg-secondary text-xs font-medium text-foreground">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {founder.name}
                      </p>
                      {founder.role && (
                        <p className="text-xs text-muted-foreground">{founder.role}</p>
                      )}
                    </div>
                  </div>

                  {isCoach && (
                    <div className="flex items-center gap-1 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
                      <button
                        onClick={() => openEditFounder(founder)}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        title="Edit founder"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {deleteConfirm === founder.id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-xs"
                            onClick={() => handleDeleteFounder(founder.id)}
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
                          onClick={() => setDeleteConfirm(founder.id)}
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          title="Remove founder"
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
            <p className="text-sm font-medium text-foreground">Delete this company</p>
            <p className="text-xs text-muted-foreground">
              Permanently remove this company and all its data. This cannot be undone.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteCompanyDialog(true)}
          >
            Delete company
          </Button>
        </div>
      </section>}

      {/* Invitations Manager */}
      <InvitationsManager />

      {/* Delete Company Confirmation Dialog */}
      <Dialog open={deleteCompanyDialog} onOpenChange={(open) => { if (!open) { setDeleteCompanyDialog(false); setDeleteCompanyConfirm("") } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {activeCompany.name}?</DialogTitle>
            <DialogDescription>
              This will permanently delete the company, all goals, key results, metrics, and founder data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="delete-confirm" className="text-sm text-muted-foreground">
                Type <span className="font-semibold text-foreground">{activeCompany.name}</span> to confirm
              </Label>
              <Input
                id="delete-confirm"
                placeholder={activeCompany.name}
                value={deleteCompanyConfirm}
                onChange={(e) => setDeleteCompanyConfirm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleDeleteCompany()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteCompanyDialog(false); setDeleteCompanyConfirm("") }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteCompany}
              disabled={deleteCompanyConfirm !== activeCompany.name || deletingCompany}
            >
              {deletingCompany ? "Deleting..." : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Founder Dialog */}
      <Dialog
        open={founderDialog.open}
        onOpenChange={(open) =>
          !open && setFounderDialog({ open: false, mode: "edit", name: "", role: "", emails: [], emailInput: "" })
        }
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Founder</DialogTitle>
            <DialogDescription>
              {"Update this founder's details and email addresses for meeting sync."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="founder-name">Name</Label>
              <Input
                id="founder-name"
                placeholder="Jane Smith"
                value={founderDialog.name}
                onChange={(e) =>
                  setFounderDialog((prev) => ({ ...prev, name: e.target.value }))
                }
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="founder-role">Role</Label>
              <Input
                id="founder-role"
                placeholder="CEO, CTO, COO..."
                value={founderDialog.role}
                onChange={(e) =>
                  setFounderDialog((prev) => ({ ...prev, role: e.target.value }))
                }
                onKeyDown={(e) => e.key === "Enter" && handleSaveFounder()}
              />
            </div>
            
            {/* Email addresses section */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="founder-email">Email addresses for meeting sync</Label>
              <div className="flex gap-2">
                <Input
                  id="founder-email"
                  placeholder="name@example.com"
                  value={founderDialog.emailInput}
                  onChange={(e) =>
                    setFounderDialog((prev) => ({ ...prev, emailInput: e.target.value }))
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
                  onClick={() => {
                    console.log("[v0] Add button clicked, emailInput:", founderDialog.emailInput)
                    addEmail()
                  }}
                  disabled={!founderDialog.emailInput.trim()}
                >
                  Add
                </Button>
              </div>
              
              {/* List of added emails */}
              {founderDialog.emails.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {founderDialog.emails.map((email) => (
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
              
              {founderDialog.emails.length === 0 && (
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
                setFounderDialog({ open: false, mode: "edit", name: "", role: "", emails: [], emailInput: "" })
              }
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                console.log("[v0] Save button clicked, emails:", founderDialog.emails)
                handleSaveFounder()
              }}
              disabled={!founderDialog.name.trim()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
