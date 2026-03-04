"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useApp } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react"

export default function AcceptInvitationPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { acceptInvitation } = useApp()
  const [status, setStatus] = useState<"loading" | "success" | "error" | "expired">("loading")
  const [message, setMessage] = useState("")
  const [companyName, setCompanyName] = useState("")

  useEffect(() => {
    const acceptToken = async () => {
      const token = searchParams.get("token")
      if (!token) {
        setStatus("error")
        setMessage("No invitation token found")
        return
      }

      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
          // User not logged in - redirect to login with token
          router.push(`/auth/login?invite=${token}`)
          return
        }

        // User is logged in - accept the invitation
        const result = await acceptInvitation(token)

        if (result.success && result.companyId) {
          setStatus("success")
          setMessage("Invitation accepted! Redirecting to your company...")
          
          // Fetch company name for display
          const { data: company } = await supabase
            .from("companies")
            .select("name")
            .eq("id", result.companyId)
            .single()
          
          if (company) {
            setCompanyName(company.name)
          }

          // Redirect to the company after a short delay
          setTimeout(() => {
            router.push("/")
          }, 2000)
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

    acceptToken()
  }, [searchParams, acceptInvitation, router])

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 text-center">
        {status === "loading" && (
          <>
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
            <h1 className="mb-2 text-lg font-semibold text-foreground">Processing Invitation...</h1>
            <p className="text-sm text-muted-foreground">Please wait while we accept your invitation.</p>
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
