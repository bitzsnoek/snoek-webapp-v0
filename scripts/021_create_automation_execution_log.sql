-- Create automation execution log table to track sent messages and prevent duplicates
CREATE TABLE IF NOT EXISTS automation_execution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  log_key TEXT NOT NULL UNIQUE, -- Unique key to prevent duplicate sends
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_automation_execution_log_key ON automation_execution_log(log_key);
CREATE INDEX IF NOT EXISTS idx_automation_execution_log_automation ON automation_execution_log(automation_id);

-- RLS policy: Only service role can access this table (used by cron)
ALTER TABLE automation_execution_log ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for cron jobs)
CREATE POLICY "Service role can manage execution logs"
  ON automation_execution_log
  FOR ALL
  USING (true)
  WITH CHECK (true);
