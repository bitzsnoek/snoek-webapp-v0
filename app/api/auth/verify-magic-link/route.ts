import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as "magiclink" | "email"
  const redirectTo = searchParams.get("redirect_to") || "/"

  if (!tokenHash || !type) {
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
    token_hash: tokenHash,
    type,
  })

  if (error) {
    console.error("Verify magic link error:", error)
    return NextResponse.redirect(new URL("/auth/error?message=Invalid or expired magic link", request.url))
  }

  // Redirect to the intended destination
  return NextResponse.redirect(new URL(redirectTo, request.url))
}
