-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Google Calendar connections table
CREATE TABLE google_calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_access_token TEXT NOT NULL, -- Will be encrypted at app level
  google_refresh_token TEXT NOT NULL, -- Will be encrypted at app level
  google_calendar_id TEXT NOT NULL, -- e.g., user@gmail.com
  last_synced_at TIMESTAMP WITH TIME ZONE,
  sync_window_start DATE DEFAULT CURRENT_DATE - INTERVAL '3 months',
  sync_window_end DATE DEFAULT CURRENT_DATE + INTERVAL '3 months',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, user_id)
);

-- Meetings table
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL, -- Google Calendar event ID
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  attendee_emails TEXT[] DEFAULT ARRAY[]::TEXT[], -- Array of attendee emails
  founder_ids UUID[] DEFAULT ARRAY[]::UUID[], -- Array of company founder user IDs
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'deleted_in_calendar', 'rescheduled')),
  has_documents BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, google_event_id)
);

-- Meeting documents table (transcripts, notes, etc.)
CREATE TABLE meeting_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  document_type TEXT DEFAULT 'notes' CHECK (document_type IN ('transcript', 'notes', 'other')),
  embedding vector(1536), -- OpenAI embedding dimension
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_google_calendar_connections_company ON google_calendar_connections(company_id);
CREATE INDEX idx_google_calendar_connections_user ON google_calendar_connections(user_id);
CREATE INDEX idx_meetings_company ON meetings(company_id);
CREATE INDEX idx_meetings_start_time ON meetings(company_id, start_time DESC);
CREATE INDEX idx_meeting_documents_meeting ON meeting_documents(meeting_id);
CREATE INDEX idx_meeting_documents_embedding ON meeting_documents USING ivfflat (embedding vector_cosine_ops);

-- Enable RLS
ALTER TABLE google_calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for google_calendar_connections
-- Coaches can view their own connections
CREATE POLICY "google_calendar_connections_select"
  ON google_calendar_connections
  FOR SELECT
  USING (
    user_id = auth.uid() OR
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid() AND role = 'coach'
    )
  );

-- Coaches can insert/update/delete their own connections
CREATE POLICY "google_calendar_connections_insert"
  ON google_calendar_connections
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid() AND role = 'coach'
    )
  );

CREATE POLICY "google_calendar_connections_update"
  ON google_calendar_connections
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "google_calendar_connections_delete"
  ON google_calendar_connections
  FOR DELETE
  USING (user_id = auth.uid());

-- RLS Policies for meetings
-- Company members can view meetings for their company
CREATE POLICY "meetings_select"
  ON meetings
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for meeting_documents
-- Company members can view documents for meetings in their company
CREATE POLICY "meeting_documents_select"
  ON meeting_documents
  FOR SELECT
  USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE company_id IN (
        SELECT company_id FROM company_members WHERE user_id = auth.uid()
      )
    )
  );

-- Coaches can insert/update/delete documents
CREATE POLICY "meeting_documents_insert"
  ON meeting_documents
  FOR INSERT
  WITH CHECK (
    meeting_id IN (
      SELECT id FROM meetings WHERE company_id IN (
        SELECT company_id FROM company_members WHERE user_id = auth.uid() AND role = 'coach'
      )
    )
  );

CREATE POLICY "meeting_documents_update"
  ON meeting_documents
  FOR UPDATE
  USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE company_id IN (
        SELECT company_id FROM company_members WHERE user_id = auth.uid() AND role = 'coach'
      )
    )
  );

CREATE POLICY "meeting_documents_delete"
  ON meeting_documents
  FOR DELETE
  USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE company_id IN (
        SELECT company_id FROM company_members WHERE user_id = auth.uid() AND role = 'coach'
      )
    )
  );
