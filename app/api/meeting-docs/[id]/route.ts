// Meeting documents API - REBUILD-2026-03-07-v4
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { embed } from "ai"
import { gateway } from "@ai-sdk/gateway"

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

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  const supabase = await createClient()
  const { id: meetingId } = await context.params

  try {
    const { data: documents, error } = await supabase
      .from("meeting_documents")
      .select("*")
      .eq("meeting_id", meetingId)
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({ documents: documents || [] })
  } catch (error) {
    console.error("Failed to fetch documents:", error)
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  console.log("[v0] meeting-docs POST called - v4")
  const supabase = await createClient()
  const { id: meetingId } = await context.params
  console.log("[v0] meetingId:", meetingId)

  try {
    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .select("company_id")
      .eq("id", meetingId)
      .single()

    if (meetingError || !meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const title = formData.get("title") as string
    const documentType = formData.get("documentType") as string || "other"

    if (!title || !file) {
      return NextResponse.json({ error: "Title and file are required" }, { status: 400 })
    }

    const content = await extractTextFromFile(file)
    const embedding = await generateEmbedding(content)

    // Build insert data - only include embedding if it's valid (non-empty)
    const insertData: Record<string, any> = {
      meeting_id: meetingId,
      title,
      content,
      document_type: documentType,
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

    if (insertError) throw insertError

    await supabase
      .from("meetings")
      .update({ has_documents: true })
      .eq("id", meetingId)

    return NextResponse.json({ document })
  } catch (error) {
    console.error("Document upload error:", error)
    return NextResponse.json({ error: "Failed to upload document" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const supabase = await createClient()
  await context.params // Ensure params are awaited
  
  const documentId = request.nextUrl.searchParams.get("documentId")

  if (!documentId) {
    return NextResponse.json({ error: "Document ID required" }, { status: 400 })
  }

  try {
    const { error } = await supabase
      .from("meeting_documents")
      .delete()
      .eq("id", documentId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete error:", error)
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 })
  }
}
