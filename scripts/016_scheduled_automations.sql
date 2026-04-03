-- Add scheduled automation config table
CREATE TABLE IF NOT EXISTS automation_scheduled_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  executed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(automation_id)
);

-- Enable RLS
ALTER TABLE automation_scheduled_config ENABLE ROW LEVEL SECURITY;

-- Policies for scheduled config
CREATE POLICY "scheduled_config_select" ON automation_scheduled_config
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM automations a
      WHERE a.id = automation_scheduled_config.automation_id
      AND a.coach_id = auth.uid()
    )
  );

CREATE POLICY "scheduled_config_insert" ON automation_scheduled_config
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM automations a
      WHERE a.id = automation_scheduled_config.automation_id
      AND a.coach_id = auth.uid()
    )
  );

CREATE POLICY "scheduled_config_update" ON automation_scheduled_config
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM automations a
      WHERE a.id = automation_scheduled_config.automation_id
      AND a.coach_id = auth.uid()
    )
  );

CREATE POLICY "scheduled_config_delete" ON automation_scheduled_config
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM automations a
      WHERE a.id = automation_scheduled_config.automation_id
      AND a.coach_id = auth.uid()
    )
  );

-- Service role policy for execution
CREATE POLICY "scheduled_config_service" ON automation_scheduled_config
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');
