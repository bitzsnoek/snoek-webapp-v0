"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useApp } from "@/lib/store"
import { isCoachOrAdmin } from "@/lib/mock-data"
import { createClient } from "@/lib/supabase/client"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { User, Mail, Lock, LogOut, Check, Building2 } from "lucide-react"
import { cn } from "@/lib/utils"

export function AccountSettings() {
  const { currentUser, clients, updateProfile } = useApp()
  const router = useRouter()
  const supabase = createClient()

  // Profile editing
  const [name, setName] = useState(currentUser.name)
  const [nameEditing, setNameEditing] = useState(false)
  const [savingName, setSavingName] = useState(false)

  // Password
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  // Sign out
  const [signingOut, setSigningOut] = useState(false)

  async function handleSaveName() {
    const trimmed = name.trim()
    if (!trimmed || trimmed === currentUser.name) {
      setNameEditing(false)
      return
    }
    setSavingName(true)
    await updateProfile(trimmed)
    setSavingName(false)
    setNameEditing(false)
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(false)

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters")
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match")
      return
    }

    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)

    if (error) {
      setPasswordError(error.message)
    } else {
      setPasswordSuccess(true)
      setNewPassword("")
      setConfirmPassword("")
      setTimeout(() => setPasswordSuccess(false), 3000)
    }
  }

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile and security settings
        </p>
      </div>

      {/* Profile Section */}
      <section className="mb-10 rounded-xl border border-border bg-card p-4 md:p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
            <User className="h-4 w-4 text-foreground" />
          </div>
          <h2 className="text-base font-semibold text-foreground">Profile</h2>
        </div>

        {/* Avatar */}
        <div className="mb-6 flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="bg-primary/20 text-lg text-primary">
              {currentUser.avatar || currentUser.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-lg font-medium text-foreground">{currentUser.name || "User"}</p>
            <p className="text-sm capitalize text-muted-foreground">{currentUser.role === "super_admin" ? "Super Admin" : currentUser.role}</p>
          </div>
        </div>

        {/* Display Name */}
        <div className="flex flex-col gap-3">
          <Label htmlFor="display-name" className="text-sm">
            Display name
          </Label>
          {nameEditing ? (
            <div className="flex items-center gap-2">
              <Input
                id="display-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName()
                  if (e.key === "Escape") {
                    setName(currentUser.name)
                    setNameEditing(false)
                  }
                }}
                autoFocus
                className="max-w-sm"
              />
              <Button size="sm" onClick={handleSaveName} disabled={savingName}>
                {savingName ? "Saving..." : "Save"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setName(currentUser.name)
                  setNameEditing(false)
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium text-foreground">
                {currentUser.name || "Not set"}
              </p>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => setNameEditing(true)}
              >
                Edit
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Email Section */}
      <section className="mb-10 rounded-xl border border-border bg-card p-4 md:p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
            <Mail className="h-4 w-4 text-foreground" />
          </div>
          <h2 className="text-base font-semibold text-foreground">Email</h2>
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">Your email address</p>
          <p className="text-sm font-medium text-foreground">{currentUser.email}</p>
        </div>
      </section>

      {/* Clients Section */}
      <section className="mb-10 rounded-xl border border-border bg-card p-4 md:p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
            <Building2 className="h-4 w-4 text-foreground" />
          </div>
          <h2 className="text-base font-semibold text-foreground">Clients</h2>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          {isCoachOrAdmin(currentUser.role)
            ? "Clients you manage as a coach."
            : "Clients you are a member of."}
        </p>

        {clients.length === 0 ? (
          <p className="text-sm text-muted-foreground">No clients connected yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {clients.map((client) => (
              <div
                key={client.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-background p-3"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{client.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {client.members.length} {client.members.length === 1 ? "member" : "members"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Password Section */}
      <section className="mb-10 rounded-xl border border-border bg-card p-4 md:p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
            <Lock className="h-4 w-4 text-foreground" />
          </div>
          <h2 className="text-base font-semibold text-foreground">Password</h2>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          Set a password to enable email and password sign-in alongside magic links.
        </p>

        <form onSubmit={handleSetPassword} className="flex flex-col gap-4 max-w-sm">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-password" className="text-sm">
              New password
            </Label>
            <Input
              id="new-password"
              type="password"
              placeholder="At least 6 characters"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setPasswordError(null); setPasswordSuccess(false) }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm-password" className="text-sm">
              Confirm password
            </Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Repeat password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(null); setPasswordSuccess(false) }}
            />
          </div>
          {passwordError && (
            <p className="text-xs text-destructive">{passwordError}</p>
          )}
          {passwordSuccess && (
            <div className="flex items-center gap-1.5 text-xs text-primary">
              <Check className="h-3.5 w-3.5" />
              Password updated successfully
            </div>
          )}
          <Button
            type="submit"
            disabled={savingPassword || !newPassword || !confirmPassword}
            className="w-fit"
          >
            {savingPassword ? "Saving..." : "Set password"}
          </Button>
        </form>
      </section>

      {/* Sign Out Section */}
      <section className="mb-10 rounded-xl border border-destructive/20 bg-card p-4 md:p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
            <LogOut className="h-4 w-4 text-destructive" />
          </div>
          <h2 className="text-base font-semibold text-foreground">Sign out</h2>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          Sign out of your account on this device.
        </p>

        <Button
          variant="outline"
          onClick={handleSignOut}
          disabled={signingOut}
          className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          {signingOut ? "Signing out..." : "Sign out"}
        </Button>
      </section>
    </div>
  )
}
