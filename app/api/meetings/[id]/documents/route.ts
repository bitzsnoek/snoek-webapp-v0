import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// Placeholder function to generate embeddings
// In production, you'd use OpenAI, Cohere, or another embedding service
async function generateEmbedding(text: string): Promise<number[]> {
  // For MVP, return a simple 384-dimensional embedding (all zeros)
  // Replace with actual embedding service call
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
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const meetingId = params.id

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
  
  // For PDF and complex formats, we'd need server-side libraries
  // For now, handle text-based formats and return file info for binary formats
  if (file.type === "application/pdf") {
    // PDF parsing would require a library like pdf-parse
    // For MVP, store file metadata
    return `[PDF Document: ${file.name}]`
  }
  
  if (file.type === "application/msword" || 
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    // Word docs would require mammoth or similar
    return `[Word Document: ${file.name}]`
  }
  
  if (file.type === "application/rtf" || file.type === "text/rtf") {
    // RTF can contain readable text, try to extract it
    // Strip RTF control codes for basic text extraction
    const rtfText = text.replace(/\\[a-z]+\d* ?|\{|\}|\\'/g, "").trim()
    return rtfText || `[RTF Document: ${file.name}]`
  }
  
  return text
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const meetingId = params.id

  try {
    // Verify user has access to this meeting
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

    if (insertError) throw insertError

    // Update meeting to indicate it has documents
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
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
