-- Create junction table for automation-founder relationships
-- This allows automations to target specific founders

CREATE TABLE IF NOT EXISTS automation_founders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  founder_member_id UUID NOT NULL REFERENCES company_members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(automation_id, founder_member_id)
);

-- Enable RLS
ALTER TABLE automation_founders ENABLE ROW LEVEL SECURITY;

-- RLS Policies (inherit from parent automation)
CREATE POLICY "automation_founders_select" ON automation_founders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM automations 
      WHERE automations.id = automation_founders.automation_id
      AND (
        automations.coach_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM company_members 
          WHERE company_members.company_id = automations.company_id 
          AND company_members.user_id = auth.uid()
          AND company_members.role = 'coach'
        )
      )
    )
  );

CREATE POLICY "automation_founders_insert" ON automation_founders
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM automations 
      WHERE automations.id = automation_founders.automation_id
      AND automations.coach_id = auth.uid()
    )
  );

CREATE POLICY "automation_founders_delete" ON automation_founders
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM automations 
      WHERE automations.id = automation_founders.automation_id
      AND automations.coach_id = auth.uid()
    )
  );

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_automation_founders_automation_id ON automation_founders(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_founders_founder_member_id ON automation_founders(founder_member_id);
