"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CheckCircle2, AlertCircle, Loader2, Lock } from "lucide-react"

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
  const [status, setStatus] = useState<"loading" | "signup" | "accepting" | "success" | "error" | "expired">("loading")
  const [message, setMessage] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [invitationEmail, setInvitationEmail] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const token = searchParams.get("token")

  // Check invitation validity and whether user is already authenticated
  async function checkInvitation() {
    if (!token) {
      setStatus("error")
      setMessage("No invitation token found")
      return
    }

    try {
      // First check if user is already authenticated
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        // Already signed in -- accept the invitation directly
        await acceptWithExistingSession()
        return
      }

      // Not authenticated -- fetch invitation details to show the signup form
      const res = await fetch(`/api/invitation-details?token=${token}`)
      const result = await res.json()

      if (result.error?.includes("expired")) {
        setStatus("expired")
        setMessage("This invitation has expired. Please ask for a new one.")
      } else if (result.error) {
        setStatus("error")
        setMessage(result.error)
      } else {
        setInvitationEmail(result.email || "")
        setEmail(result.email || "")
        if (result.companyName) setCompanyName(result.companyName)
        setStatus("signup")
      }
    } catch {
      setStatus("error")
      setMessage("An error occurred while loading the invitation")
    }
  }

  // Accept invitation when user is already signed in
  async function acceptWithExistingSession() {
    setStatus("accepting")
    try {
      const res = await fetch("/api/accept-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
      const result = await res.json()

      if (result.success) {
        setStatus("success")
        setTimeout(() => router.push("/"), 2000)
      } else {
        setStatus("error")
        setMessage(result.error || "Failed to accept invitation")
      }
    } catch {
      setStatus("error")
      setMessage("An error occurred while accepting the invitation")
    }
  }

  // Handle the combined signup + accept invitation flow
  async function handleSignupAndAccept(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (password.length < 8) {
      setFormError("Password must be at least 8 characters.")
      return
    }
    if (password !== confirmPassword) {
      setFormError("Passwords do not match.")
      return
    }

    setSubmitting(true)
    try {
      // 1. Create account + accept invitation in one API call
      const res = await fetch("/api/accept-invitation-with-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email, password }),
      })
      const result = await res.json()

      if (!res.ok || !result.success) {
        setFormError(result.error || "Failed to create account")
        setSubmitting(false)
        return
      }

      // 2. Sign in with the new credentials
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setFormError("Account created but sign-in failed. Try logging in manually.")
        setSubmitting(false)
        return
      }

      // 3. Success!
      setStatus("success")
      setTimeout(() => router.push("/"), 2000)
    } catch {
      setFormError("Something went wrong. Please try again.")
      setSubmitting(false)
    }
  }

  useEffect(() => {
    checkInvitation()
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

        {status === "signup" && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <h1 className="mb-2 text-lg font-semibold text-foreground">
              {companyName ? `Join ${companyName}` : "Accept Your Invitation"}
            </h1>
            <p className="mb-6 text-sm text-muted-foreground">
              {"Set a password to create your account and join the company."}
            </p>

            <form onSubmit={handleSignupAndAccept} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Email</label>
                <Input
                  type="email"
                  value={email}
                  disabled
                  className="w-full bg-muted"
                />
                {invitationEmail && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {"This invitation was sent to this email address."}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Password</label>
                <Input
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={submitting}
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
                  disabled={submitting}
                  className="w-full"
                />
              </div>
              {formError && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                  <p className="text-xs text-destructive">{formError}</p>
                </div>
              )}
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? "Creating account..." : "Create Account & Join"}
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
