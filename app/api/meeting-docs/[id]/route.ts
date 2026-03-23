import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { embed } from "ai"
import { gateway } from "@ai-sdk/gateway"
import { z } from "zod"
import {
  requireAuth,
  requireMeetingAccess,
  validateInput,
  errorResponse,
  successResponse,
  ERROR_MESSAGES,
  schemas,
} from "@/lib/api-security"

async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const { embedding } = await embed({
      model: gateway.textEmbeddingModel("openai/text-embedding-3-small"),
      value: text,
    })
    return embedding
  } catch (error) {
    console.error("Embedding generation failed:", error)
    return []
  }
}

// Extract text from uploaded files
async function extractTextFromFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const text = new TextDecoder().decode(buffer)
  
  if (file.type === "application/pdf") {
    return `[PDF Document: ${file.name}]`
  }
  
  if (file.type === "application/msword" || 
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return `[Word Document: ${file.name}]`
  }
  
  if (file.type === "application/rtf" || file.type === "text/rtf") {
    const rtfText = text.replace(/\\[a-z]+\d* ?|\{|\}|\\'/g, "").trim()
    return rtfText || `[RTF Document: ${file.name}]`
  }
  
  return text
}

const uploadSchema = z.object({
  title: z.string().min(1).max(500),
  documentType: z.enum(["transcript", "notes", "other"]).optional().default("other"),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    // 1. Authentication
    const { user, error: authError } = await requireAuth()
    if (authError) return authError
    if (!user) return errorResponse(ERROR_MESSAGES.UNAUTHORIZED, 401)

    const { id: meetingId } = await context.params

    // 2. Validate meeting ID
    const uuidValidation = validateInput(schemas.uuid, meetingId)
    if (!uuidValidation.success) return uuidValidation.error

    // 3. Authorization - verify user has access to this meeting
    const { hasAccess } = await requireMeetingAccess(user.id, meetingId)
    if (!hasAccess) {
      return errorResponse(ERROR_MESSAGES.FORBIDDEN, 403)
    }

    const supabase = await createClient()
    const { data: documents, error } = await supabase
      .from("meeting_documents")
      .select("*")
      .eq("meeting_id", meetingId)
      .order("created_at", { ascending: false })

    if (error) throw error

    return successResponse({ documents: documents || [] })
  } catch (error) {
    console.error("Failed to fetch documents:", error)
    return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // 1. Authentication
    const { user, error: authError } = await requireAuth()
    if (authError) return authError
    if (!user) return errorResponse(ERROR_MESSAGES.UNAUTHORIZED, 401)

    const { id: meetingId } = await context.params

    // 2. Validate meeting ID
    const uuidValidation = validateInput(schemas.uuid, meetingId)
    if (!uuidValidation.success) return uuidValidation.error

    // 3. Authorization - verify user has access to this meeting
    const { hasAccess } = await requireMeetingAccess(user.id, meetingId)
    if (!hasAccess) {
      return errorResponse(ERROR_MESSAGES.FORBIDDEN, 403)
    }

    const supabase = await createClient()

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const title = formData.get("title") as string
    const documentType = formData.get("documentType") as string || "other"

    // 4. Validate form data
    const formValidation = validateInput(uploadSchema, { title, documentType })
    if (!formValidation.success) return formValidation.error

    if (!file) {
      return errorResponse(ERROR_MESSAGES.BAD_REQUEST, 400, "File is required")
    }

    // 5. Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return errorResponse(ERROR_MESSAGES.BAD_REQUEST, 400, "File too large (max 10MB)")
    }

    const content = await extractTextFromFile(file)
    const embedding = await generateEmbedding(content)

    // Build insert data - only include embedding if it's valid (non-empty)
    const insertData: Record<string, unknown> = {
      meeting_id: meetingId,
      title: formValidation.data.title,
      content,
      document_type: formValidation.data.documentType,
    }
    
    // Only add embedding if it has dimensions (AI Gateway may not be configured)
    if (embedding && embedding.length > 0) {
      insertData.embedding = embedding
    }
    
    const { data: document, error: insertError } = await supabase
      .from("meeting_documents")
      .insert(insertData)
      .select()
      .single()

    if (insertError) {
      console.error("Insert error:", insertError)
      return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
    }

    await supabase
      .from("meetings")
      .update({ has_documents: true })
      .eq("id", meetingId)

    return successResponse({ document })
  } catch (error) {
    console.error("Document upload error:", error)
    return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    // 1. Authentication
    const { user, error: authError } = await requireAuth()
    if (authError) return authError
    if (!user) return errorResponse(ERROR_MESSAGES.UNAUTHORIZED, 401)

    const { id: meetingId } = await context.params
    const documentId = request.nextUrl.searchParams.get("documentId")

    // 2. Validate IDs
    const meetingIdValidation = validateInput(schemas.uuid, meetingId)
    if (!meetingIdValidation.success) return meetingIdValidation.error

    if (!documentId) {
      return errorResponse(ERROR_MESSAGES.BAD_REQUEST, 400, "Document ID required")
    }

    const docIdValidation = validateInput(schemas.uuid, documentId)
    if (!docIdValidation.success) return docIdValidation.error

    // 3. Authorization - verify user has access to this meeting
    const { hasAccess } = await requireMeetingAccess(user.id, meetingId)
    if (!hasAccess) {
      return errorResponse(ERROR_MESSAGES.FORBIDDEN, 403)
    }

    const supabase = await createClient()

    // 4. Verify document belongs to this meeting before deleting
    const { data: doc } = await supabase
      .from("meeting_documents")
      .select("id")
      .eq("id", documentId)
      .eq("meeting_id", meetingId)
      .single()

    if (!doc) {
      return errorResponse(ERROR_MESSAGES.NOT_FOUND, 404)
    }

    const { error } = await supabase
      .from("meeting_documents")
      .delete()
      .eq("id", documentId)

    if (error) throw error

    return successResponse({ success: true })
  } catch (error) {
    console.error("Delete error:", error)
    return errorResponse(ERROR_MESSAGES.INTERNAL_ERROR, 500)
  }
}
