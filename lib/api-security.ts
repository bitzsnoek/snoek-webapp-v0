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

export async function requireCompanyAccess(
  userId: string,
  companyId: string,
  requiredRole?: "coach" | "founder"
) {
  const supabase = await createClient()
  
  let query = supabase
    .from("company_members")
    .select("id, role")
    .eq("company_id", companyId)
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
  
  // Get the meeting's company
  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .select("company_id")
    .eq("id", meetingId)
    .single()

  if (meetingError || !meeting) {
    return { hasAccess: false, companyId: null }
  }

  // Check if user is a member of that company
  const { hasAccess } = await requireCompanyAccess(userId, meeting.company_id)
  
  return { hasAccess, companyId: meeting.company_id }
}

export async function requireConversationAccess(
  userId: string,
  conversationId: string
) {
  const supabase = await createClient()
  
  const { data: conversation, error } = await supabase
    .from("conversations")
    .select("coach_id, founder_id")
    .eq("id", conversationId)
    .single()

  if (error || !conversation) {
    return { hasAccess: false, isParticipant: false }
  }

  const isParticipant = conversation.coach_id === userId || conversation.founder_id === userId
  
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
  const cronSecret = process.env.CRON_SECRET
  
  // CRON_SECRET must be set - fail closed
  if (!cronSecret) {
    console.error("CRON_SECRET is not configured - rejecting request")
    return false
  }
  
  const authHeader = request.headers.get("authorization")
  return authHeader === `Bearer ${cronSecret}`
}
