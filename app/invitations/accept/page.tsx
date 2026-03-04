"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CheckCircle2, AlertCircle, Loader2, Mail, Lock } from "lucide-react"

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-background p-4">
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 text-center">
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
            <h1 className="mb-2 text-lg font-semibold text-foreground">Processing Invitation...</h1>
            <p className="text-sm text-muted-foreground">Please wait while we accept your invitation.</p>
          </div>
        </div>
      }
    >
      <AcceptInvitationInner />
    </Suspense>
  )
}

function AcceptInvitationInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [status, setStatus] = useState<"loading" | "needs-auth" | "accepting" | "set-password" | "success" | "error" | "expired">("loading")
  const [message, setMessage] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [companyId, setCompanyId] = useState("")
  const [email, setEmail] = useState("")
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [sendingLink, setSendingLink] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [savingPassword, setSavingPassword] = useState(false)

  const token = searchParams.get("token")

  // Try to accept the invitation if user is authenticated
  async function tryAcceptInvitation() {
    if (!token) {
      setStatus("error")
      setMessage("No invitation token found")
      return
    }

    setStatus("accepting")

    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setStatus("needs-auth")
        return
      }

      // Call server-side API route that uses service role to bypass RLS
      const res = await fetch("/api/accept-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
      const result = await res.json()

      if (result.success && result.companyId) {
        setCompanyId(result.companyId)

        const { data: company } = await supabase
          .from("companies")
          .select("name")
          .eq("id", result.companyId)
          .single()

        if (company) setCompanyName(company.name)

        // Go to set-password step so the new user creates a password
        setStatus("set-password")
      } else if (result.error?.includes("expired")) {
        setStatus("expired")
        setMessage("This invitation has expired. Please ask for a new one.")
      } else {
        setStatus("error")
        setMessage(result.error || "Failed to accept invitation")
      }
    } catch (err) {
      setStatus("error")
      setMessage("An error occurred while accepting the invitation")
      console.error("Accept invitation error:", err)
    }
  }

  // Send magic link for authentication via Postmark
  async function handleSendMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setSendingLink(true)
    setAuthError(null)

    try {
      // After verify-magic-link establishes the session, redirect directly
      // back to this accept page to complete the invitation acceptance
      const redirectTo = `${window.location.origin}/invitations/accept?token=${token}`

      const res = await fetch("/api/send-magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, redirectTo }),
      })
      const result = await res.json()

      if (!res.ok || result.error) {
        setAuthError(result.error || "Failed to send magic link")
      } else {
        setMagicLinkSent(true)
      }
    } catch {
      setAuthError("Failed to send magic link. Please try again.")
    } finally {
      setSendingLink(false)
    }
  }

  // Set password for the newly authenticated user
  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError(null)

    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters.")
      return
    }
    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match.")
      return
    }

    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setPasswordError(error.message)
      } else {
        setStatus("success")
        setTimeout(() => router.push("/"), 2000)
      }
    } catch {
      setPasswordError("Something went wrong. Please try again.")
    } finally {
      setSavingPassword(false)
    }
  }

  // Initial check + listen for auth state changes (e.g. after magic link clicked in same browser)
  useEffect(() => {
    tryAcceptInvitation()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        tryAcceptInvitation()
      }
    })

    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 text-center">
        {(status === "loading" || status === "accepting") && (
          <>
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
            <h1 className="mb-2 text-lg font-semibold text-foreground">Processing Invitation...</h1>
            <p className="text-sm text-muted-foreground">Please wait while we process your invitation.</p>
          </>
        )}

        {status === "needs-auth" && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <h1 className="mb-2 text-lg font-semibold text-foreground">Accept Your Invitation</h1>
            <p className="mb-6 text-sm text-muted-foreground">
              {"Enter your email to sign in and join the company. If you don't have an account yet, one will be created for you."}
            </p>

            {magicLinkSent ? (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-primary" />
                <p className="text-sm font-medium text-foreground">Check your email!</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {"We've sent a magic link to "}<strong>{email}</strong>{". Click it to sign in and accept the invitation."}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSendMagicLink} className="space-y-4 text-left">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Email</label>
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={sendingLink}
                    className="w-full"
                  />
                </div>
                {authError && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                    <p className="text-xs text-destructive">{authError}</p>
                  </div>
                )}
                <Button type="submit" disabled={sendingLink} className="w-full">
                  {sendingLink ? "Sending..." : "Send Magic Link"}
                </Button>
              </form>
            )}
          </>
        )}

        {status === "set-password" && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <h1 className="mb-2 text-lg font-semibold text-foreground">
              Set Your Password
            </h1>
            <p className="mb-6 text-sm text-muted-foreground">
              {companyName
                ? `You've joined ${companyName}! Create a password so you can sign in anytime.`
                : "Create a password so you can sign in anytime."}
            </p>

            <form onSubmit={handleSetPassword} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Password</label>
                <Input
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={savingPassword}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Confirm password</label>
                <Input
                  type="password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={savingPassword}
                  className="w-full"
                />
              </div>
              {passwordError && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                  <p className="text-xs text-destructive">{passwordError}</p>
                </div>
              )}
              <Button type="submit" disabled={savingPassword} className="w-full">
                {savingPassword ? "Saving..." : "Set Password & Continue"}
              </Button>
            </form>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 className="mx-auto mb-4 h-8 w-8 text-primary" />
            <h1 className="mb-2 text-lg font-semibold text-foreground">
              Welcome to {companyName || "Snoek"}!
            </h1>
            <p className="mb-4 text-sm text-muted-foreground">
              Your invitation has been accepted. Redirecting you to your company...
            </p>
            <div className="flex justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <AlertCircle className="mx-auto mb-4 h-8 w-8 text-destructive" />
            <h1 className="mb-2 text-lg font-semibold text-foreground">Invitation Error</h1>
            <p className="mb-4 text-sm text-muted-foreground">{message}</p>
            <Button onClick={() => router.push("/")}>Go to Dashboard</Button>
          </>
        )}

        {status === "expired" && (
          <>
            <AlertCircle className="mx-auto mb-4 h-8 w-8 text-warning" />
            <h1 className="mb-2 text-lg font-semibold text-foreground">Invitation Expired</h1>
            <p className="mb-4 text-sm text-muted-foreground">
              This invitation link has expired. Please ask the person who invited you to send a new one.
            </p>
            <Button onClick={() => router.push("/")}>Go to Dashboard</Button>
          </>
        )}
      </div>
    </div>
  )
}
