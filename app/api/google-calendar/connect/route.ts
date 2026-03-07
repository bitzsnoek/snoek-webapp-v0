import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ")

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const companyId = request.nextUrl.searchParams.get("company_id")
  if (!companyId) {
    return NextResponse.json({ error: "Missing company_id" }, { status: 400 })
  }

  // Verify user is a coach in this company
  const { data: member } = await supabase
    .from("company_members")
    .select("*")
    .eq("company_id", companyId)
    .eq("user_id", user.id)
    .eq("role", "coach")
    .single()

  if (!member) {
    return NextResponse.json({ error: "Not a coach in this company" }, { status: 403 })
  }

  // Build OAuth URL
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/google-calendar/callback`
  const state = JSON.stringify({ company_id: companyId, user_id: user.id })

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_OAUTH_SCOPES,
    state,
    access_type: "offline",
    prompt: "consent",
  })

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}
