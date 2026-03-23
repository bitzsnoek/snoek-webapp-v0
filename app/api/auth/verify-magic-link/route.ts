import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

// Validate the token hash format to prevent injection
const verifySchema = z.object({
  token_hash: z.string().min(10).max(500),
  type: z.enum(["magiclink", "email"]),
  redirect_to: z.string().max(2000).optional(),
})

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type")
  const redirectTo = searchParams.get("redirect_to") || "/"

  // Validate inputs
  const validation = verifySchema.safeParse({
    token_hash: tokenHash,
    type: type,
    redirect_to: redirectTo,
  })

  if (!validation.success) {
    return NextResponse.redirect(new URL("/auth/error", request.url))
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        },
      },
    }
  )

  // Verify the OTP token hash -- this establishes the session
  const { error } = await supabase.auth.verifyOtp({
    token_hash: validation.data.token_hash,
    type: validation.data.type,
  })

  if (error) {
    console.error("Verify magic link error:", error.code)
    // Don't expose detailed error messages
    return NextResponse.redirect(new URL("/auth/error?message=Invalid or expired link", request.url))
  }

  // Validate the redirect URL to prevent open redirects
  let safeRedirect = "/"
  try {
    const redirectUrl = new URL(validation.data.redirect_to || "/", request.url)
    // Only allow redirects to the same origin
    if (redirectUrl.origin === new URL(request.url).origin) {
      safeRedirect = redirectUrl.pathname + redirectUrl.search
    }
  } catch {
    // Invalid URL, use default
  }

  // Redirect to the intended destination
  return NextResponse.redirect(new URL(safeRedirect, request.url))
}
