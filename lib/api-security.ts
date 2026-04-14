import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

// ============================================================
// Error Messages (sanitized for production)
// ============================================================

export const ERROR_MESSAGES = {
  UNAUTHORIZED: "Authentication required",
  FORBIDDEN: "Access denied",
  NOT_FOUND: "Resource not found",
  BAD_REQUEST: "Invalid request",
  RATE_LIMITED: "Too many requests. Please try again later.",
  INTERNAL_ERROR: "Something went wrong. Please try again.",
  VALIDATION_ERROR: "Invalid input data",
} as const

// ============================================================
// Response Helpers (sanitized errors)
// ============================================================

export function errorResponse(
  message: string,
  status: number,
  details?: string
) {
  // In production, don't expose detailed error messages
  const isProduction = process.env.NODE_ENV === "production"
  const safeMessage = isProduction ? message : `${message}${details ? `: ${details}` : ""}`
  
  return NextResponse.json({ error: safeMessage }, { status })
}

export function successResponse<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status })
}

// ============================================================
// Authentication Helper
// ============================================================

export async function requireAuth(request?: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return { user: null, supabase, error: errorResponse(ERROR_MESSAGES.UNAUTHORIZED, 401) }
  }

  return { user, supabase, error: null }
}

// ============================================================
// Authorization Helpers
// ============================================================

async function checkSuperAdmin(userId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", userId)
    .single()
  return data?.is_super_admin === true
}

export async function requireClientAccess(
  userId: string,
  clientId: string,
  requiredRole?: "coach" | "founder"
) {
  if (await checkSuperAdmin(userId)) {
    return { hasAccess: true, role: "coach" as const }
  }

  const supabase = await createClient()

  let query = supabase
    .from("client_members")
    .select("id, role")
    .eq("client_id", clientId)
    .eq("user_id", userId)

  if (requiredRole) {
    query = query.eq("role", requiredRole)
  }

  const { data: member, error } = await query.single()

  if (error || !member) {
    return { hasAccess: false, role: null }
  }

  return { hasAccess: true, role: member.role as "coach" | "founder" }
}

export async function requireMeetingAccess(
  userId: string,
  meetingId: string
) {
  const supabase = await createClient()
  
  // Get the meeting's client
  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .select("client_id")
    .eq("id", meetingId)
    .single()

  if (meetingError || !meeting) {
    return { hasAccess: false, clientId: null }
  }

  // Check if user is a member of that client
  const { hasAccess } = await requireClientAccess(userId, meeting.client_id)

  return { hasAccess, clientId: meeting.client_id }
}

export async function requireConversationAccess(
  userId: string,
  conversationId: string
) {
  const supabase = await createClient()

  const { data: conversation, error } = await supabase
    .from("conversations")
    .select("coach_id, member_id")
    .eq("id", conversationId)
    .single()

  if (error || !conversation) {
    return { hasAccess: false, isParticipant: false }
  }

  const isParticipant = conversation.coach_id === userId || conversation.member_id === userId

  if (!isParticipant && await checkSuperAdmin(userId)) {
    return { hasAccess: true, isParticipant: false }
  }

  return { hasAccess: isParticipant, isParticipant }
}

// ============================================================
// Rate Limiting (in-memory for simplicity, use Redis in production)
// ============================================================

const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(
  identifier: string,
  limit: number = 10,
  windowMs: number = 60000 // 1 minute
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const key = identifier
  const record = rateLimitStore.get(key)

  // Clean up expired entries periodically
  if (Math.random() < 0.01) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetAt < now) rateLimitStore.delete(k)
    }
  }

  if (!record || record.resetAt < now) {
    // New window
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs }
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt }
  }

  record.count++
  return { allowed: true, remaining: limit - record.count, resetAt: record.resetAt }
}

export function getRateLimitKey(request: NextRequest, prefix: string): string {
  // Use forwarded IP or fallback
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() 
    || request.headers.get("x-real-ip") 
    || "unknown"
  return `${prefix}:${ip}`
}

// ============================================================
// Input Validation Schemas
// ============================================================

export const schemas = {
  email: z.string().email().max(255).toLowerCase(),
  uuid: z.string().uuid(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(255).trim(),
  token: z.string().min(10).max(500),
  message: z.string().min(1).max(10000),
  url: z.string().url().max(2000),
}

// ============================================================
// Validation Helper
// ============================================================

export function validateInput<T extends z.ZodType>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; error: NextResponse } {
  const result = schema.safeParse(data)
  
  if (!result.success) {
    const firstError = result.error.errors[0]
    return {
      success: false,
      error: errorResponse(
        ERROR_MESSAGES.VALIDATION_ERROR,
        400,
        `${firstError.path.join(".")}: ${firstError.message}`
      ),
    }
  }
  
  return { success: true, data: result.data }
}

// ============================================================
// CRON Secret Validation
// ============================================================

export function validateCronSecret(request: Request): boolean {
  const authHeader = request.headers.get("authorization")
  
  // Check for CRON_SECRET (Vercel Cron)
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true
  }
  
  // Check for Supabase service role key (pg_cron via pg_net)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`) {
    return true
  }
  
  // Check for Supabase pg_cron header (hardcoded secret)
  const supabaseCronHeader = request.headers.get("x-supabase-cron")
  const cronSecretHeader = request.headers.get("x-cron-secret")
  if (supabaseCronHeader === "true" && cronSecretHeader === "snoek-automation-cron-2026") {
    return true
  }
  
  return false
}
