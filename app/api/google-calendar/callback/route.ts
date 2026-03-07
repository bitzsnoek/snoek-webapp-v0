import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const code = request.nextUrl.searchParams.get("code")
  const state = request.nextUrl.searchParams.get("state")

  if (!code || !state) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 })
  }

  try {
    const { company_id, user_id } = JSON.parse(state)

    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/google-calendar/callback`,
        grant_type: "authorization_code",
      }).toString(),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error("Token exchange failed:", errorText)
      throw new Error("Failed to exchange code for tokens")
    }

    const tokenData = await tokenResponse.json()
    const { access_token, refresh_token } = tokenData
    console.log("[v0] Token exchange successful, got access_token:", !!access_token, "refresh_token:", !!refresh_token)

    // Get user's calendar ID (email)
    const calendarResponse = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList/primary", {
      headers: { Authorization: `Bearer ${access_token}` },
    })

    if (!calendarResponse.ok) {
      throw new Error("Failed to get calendar info")
    }

    const { id: calendar_id } = await calendarResponse.json()

    console.log("[v0] Saving calendar connection for company:", company_id, "user:", user_id, "calendar:", calendar_id)

    // Save to database - first try to delete existing, then insert fresh
    // This avoids issues with upsert and RLS policies
    await supabase
      .from("google_calendar_connections")
      .delete()
      .eq("company_id", company_id)

    const { data: insertData, error: dbError } = await supabase
      .from("google_calendar_connections")
      .insert({
        company_id,
        user_id,
        google_access_token: access_token,
        google_refresh_token: refresh_token || access_token, // Some flows don't return refresh_token
        google_calendar_id: calendar_id,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()

    console.log("[v0] Insert result:", insertData, "error:", dbError)

    if (dbError) {
      console.error("DB error saving calendar connection:", dbError)
      throw new Error(`Failed to save connection: ${dbError.message}`)
    }

    // Redirect back to the meetings section
    return NextResponse.redirect(new URL(`/?section=meetings&company=${company_id}`, request.nextUrl.origin))
  } catch (error) {
    console.error("OAuth callback error:", error)
    return NextResponse.json({ error: "Failed to complete authorization" }, { status: 500 })
  }
}
