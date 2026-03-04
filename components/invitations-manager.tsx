"use client"

import { useState, useEffect } from "react"
import { useApp } from "@/lib/store"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Mail, Copy, Trash2, X } from "lucide-react"
import type { Invitation } from "@/lib/supabase-data"

export function InvitationsManager() {
  const { inviteUser, getInvitations, cancelInvitation } = useApp()
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"founder" | "coach">("founder")
  const [inviting, setInviting] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    loadInvitations()
  }, [])

  async function loadInvitations() {
    setLoading(true)
    const data = await getInvitations()
    setInvitations(data)
    setLoading(false)
  }

  async function handleInvite() {
    if (!email.trim()) return
    setInviting(true)
    const result = await inviteUser(email, role)
    setInviting(false)
    
    if (result) {
      await loadInvitations()
      setEmail("")
      setRole("founder")
      setDialogOpen(false)
    }
  }

  async function handleCancel(invitationId: string) {
    await cancelInvitation(invitationId)
    await loadInvitations()
  }

  function copyInviteLink(token: string) {
    const link = `${window.location.origin}/invitations/accept?token=${token}`
    navigator.clipboard.writeText(link)
    setCopiedId(token)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const pendingInvitations = invitations.filter((inv) => inv.status === "pending")
  const acceptedInvitations = invitations.filter((inv) => inv.status === "accepted")

  return (
    <>
      {/* Invite Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite to Company</DialogTitle>
            <DialogDescription>
              Send an invitation to a founder or coach to join your company.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="founder@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as "founder" | "coach")}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="founder">Founder</SelectItem>
                  <SelectItem value="coach">Coach</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={!email.trim() || inviting}>
              {inviting ? "Inviting..." : "Send invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Main Section */}
      <section className="mt-10 rounded-xl border border-border bg-card p-4 md:p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Mail className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Manage Users</h2>
          </div>
          <Button onClick={() => setDialogOpen(true)} size="sm">
            Invite user
          </Button>
        </div>

        {loading ? (
          <div className="text-center text-sm text-muted-foreground">Loading invitations...</div>
        ) : pendingInvitations.length === 0 && acceptedInvitations.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground">
            No invitations yet. Click "Invite user" to get started.
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Pending Invitations */}
            {pendingInvitations.length > 0 && (
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-medium text-foreground">Pending ({pendingInvitations.length})</h3>
                <div className="space-y-2">
                  {pendingInvitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex flex-col gap-2 rounded-lg border border-border/50 bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground break-all">{inv.email}</p>
                        <p className="text-xs text-muted-foreground capitalize">{inv.role}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyInviteLink(inv.token)}
                          className="gap-1.5"
                        >
                          <Copy className="h-4 w-4" />
                          {copiedId === inv.token ? "Copied" : "Copy link"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancel(inv.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Accepted Invitations */}
            {acceptedInvitations.length > 0 && (
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-medium text-foreground">Accepted ({acceptedInvitations.length})</h3>
                <div className="space-y-2">
                  {acceptedInvitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex flex-col gap-2 rounded-lg border border-border/50 bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground break-all">{inv.email}</p>
                        <p className="text-xs text-muted-foreground capitalize">{inv.role} • Joined</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </>
  )
}
