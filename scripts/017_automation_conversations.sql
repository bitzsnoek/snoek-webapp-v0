-- Create automation_conversations table to link automations to conversations
-- This replaces automation_founders for a more flexible approach

CREATE TABLE IF NOT EXISTS automation_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(automation_id, conversation_id)
);

-- Enable RLS
ALTER TABLE automation_conversations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "automation_conversations_select" ON automation_conversations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM automations a
      WHERE a.id = automation_id AND a.coach_id = auth.uid()
    )
  );

CREATE POLICY "automation_conversations_insert" ON automation_conversations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM automations a
      WHERE a.id = automation_id AND a.coach_id = auth.uid()
    )
  );

CREATE POLICY "automation_conversations_delete" ON automation_conversations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM automations a
      WHERE a.id = automation_id AND a.coach_id = auth.uid()
    )
  );

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_automation_conversations_automation 
  ON automation_conversations(automation_id);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE automation_conversations;
