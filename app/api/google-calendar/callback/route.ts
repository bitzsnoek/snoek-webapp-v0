import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  errorResponse,
  ERROR_MESSAGES,
  schemas,
} from "@/lib/api-security"

// Schema for the state parameter
const stateSchema = z.object({
  client_id: schemas.uuid,
  user_id: schemas.uuid,
})

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const code = request.nextUrl.searchParams.get("code")
  const state = request.nextUrl.searchParams.get("state")

  if (!code || !state) {
    return errorResponse(ERROR_MESSAGES.BAD_REQUEST, 400)
  }

  try {
    // Parse and validate state
    let parsedState: z.infer<typeof stateSchema>
    try {
      parsedState = stateSchema.parse(JSON.parse(state))
    } catch {
      return errorResponse(ERROR_MESSAGES.BAD_REQUEST, 400)
    }

    const { client_id, user_id } = parsedState

    // Verify the authenticated user matches the state
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.id !== user_id) {
      return errorResponse(ERROR_MESSAGES.UNAUTHORIZED, 401)
    }

    // Check required environment variables
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (!clientId || !clientSecret || !appUrl) {
      console.error("Google OAuth not configured")
      return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
    }

    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${appUrl}/api/google-calendar/callback`,
        grant_type: "authorization_code",
      }).toString(),
    })

    if (!tokenResponse.ok) {
      console.error("Token exchange failed")
      return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
    }

    const tokenData = await tokenResponse.json()
    const { access_token, refresh_token } = tokenData

    if (!access_token) {
      console.error("No access token received")
      return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
    }

    // Get user's calendar ID (email)
    const calendarResponse = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList/primary", {
      headers: { Authorization: `Bearer ${access_token}` },
    })

    if (!calendarResponse.ok) {
      console.error("Failed to get calendar info")
      return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
    }

    const { id: calendar_id } = await calendarResponse.json()

    // Save to database - first try to delete existing, then insert fresh
    // This avoids issues with upsert and RLS policies
    await supabase
      .from("google_calendar_connections")
      .delete()
      .eq("client_id", client_id)

    const { error: dbError } = await supabase
      .from("google_calendar_connections")
      .insert({
        client_id,
        user_id,
        google_access_token: access_token,
        google_refresh_token: refresh_token || access_token, // Some flows don't return refresh_token
        google_calendar_id: calendar_id,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

    if (dbError) {
      console.error("DB error saving calendar connection:", dbError)
      return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
    }

    // Redirect back to the meetings section
    return NextResponse.redirect(new URL(`/?section=meetings&client=${client_id}`, request.nextUrl.origin))
  } catch (error) {
    console.error("OAuth callback error:", error)
    return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
  }
}
