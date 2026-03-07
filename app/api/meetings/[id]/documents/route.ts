// v2 - Force redeploy with Next.js 16 async params
import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// Placeholder function to generate embeddings
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch("https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2", {
    headers: { Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}` },
    method: "POST",
    body: JSON.stringify({ inputs: text, truncate: true }),
  })

  if (!response.ok) {
    console.error("Embedding generation failed, returning zeros")
    return Array(384).fill(0)
  }

  const embedding = await response.json()
  return embedding[0] || Array(384).fill(0)
}

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id: meetingId } = await props.params

  console.log("[v0] GET documents for meeting:", meetingId)

  try {
    const { data: documents, error } = await supabase
      .from("meeting_documents")
      .select("*")
      .eq("meeting_id", meetingId)
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({ documents })
  } catch (error) {
    console.error("Failed to fetch documents:", error)
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    )
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

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id: meetingId } = await props.params

  console.log("[v0] POST document for meeting:", meetingId)

  try {
    // Verify user has access to this meeting
    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .select("company_id")
      .eq("id", meetingId)
      .single()

    if (meetingError || !meeting) {
      console.log("[v0] Meeting not found:", meetingId, meetingError)
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const title = formData.get("title") as string
    const documentType = formData.get("documentType") as string || "other"

    console.log("[v0] Uploading document:", { title, documentType, fileName: file?.name })

    if (!title || !file) {
      return NextResponse.json(
        { error: "Title and file are required" },
        { status: 400 }
      )
    }

    // Extract text content from the file
    const content = await extractTextFromFile(file)

    // Generate embedding for the document content
    const embedding = await generateEmbedding(content)

    // Store document with embedding
    const { data: document, error: insertError } = await supabase
      .from("meeting_documents")
      .insert({
        meeting_id: meetingId,
        title,
        content,
        document_type: documentType,
        embedding,
      })
      .select()
      .single()

    if (insertError) {
      console.error("[v0] Insert error:", insertError)
      throw insertError
    }

    // Update meeting to indicate it has documents
    await supabase
      .from("meetings")
      .update({ has_documents: true })
      .eq("id", meetingId)

    console.log("[v0] Document uploaded successfully:", document?.id)
    return NextResponse.json({ document })
  } catch (error) {
    console.error("Document upload error:", error)
    return NextResponse.json({ error: "Failed to upload document" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  await props.params // Await params even if not using the id
  const url = new URL(request.url)
  const docId = url.searchParams.get("docId")

  if (!docId) {
    return NextResponse.json({ error: "Document ID required" }, { status: 400 })
  }

  try {
    const { error } = await supabase
      .from("meeting_documents")
      .delete()
      .eq("id", docId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete document:", error)
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 })
  }
}
