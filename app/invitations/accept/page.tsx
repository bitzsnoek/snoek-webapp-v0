"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CheckCircle2, AlertCircle, Loader2, Mail } from "lucide-react"

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
  const [status, setStatus] = useState<"loading" | "needs-auth" | "accepting" | "success" | "error" | "expired">("loading")
  const [message, setMessage] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [email, setEmail] = useState("")
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [sendingLink, setSendingLink] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

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
        setStatus("success")

        const { data: company } = await supabase
          .from("companies")
          .select("name")
          .eq("id", result.companyId)
          .single()

        if (company) setCompanyName(company.name)

        setTimeout(() => router.push("/"), 2000)
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

  // Send magic link for authentication
  async function handleSendMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setSendingLink(true)
    setAuthError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/invitations/accept?token=${token}`,
      },
    })

    if (error) {
      setAuthError(error.message)
      setSendingLink(false)
    } else {
      setMagicLinkSent(true)
      setSendingLink(false)
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
