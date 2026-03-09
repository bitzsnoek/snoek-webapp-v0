-- Create automations tables for coach-to-founder automated messaging

-- Main automations table
CREATE TABLE IF NOT EXISTS automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('recurring', 'meeting_trigger')),
  message_content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Recurring automation configuration (type = 'recurring')
CREATE TABLE IF NOT EXISTS automation_recurring_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL UNIQUE REFERENCES automations(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  day_of_week INTEGER, -- 0-6 for weekly (0 = Sunday)
  day_of_month INTEGER, -- 1-31 for monthly
  time_of_day TIME NOT NULL, -- e.g., '09:00:00'
  cron_job_name TEXT -- stored cron job name for management
);

-- Meeting trigger automation configuration (type = 'meeting_trigger')
CREATE TABLE IF NOT EXISTS automation_meeting_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL UNIQUE REFERENCES automations(id) ON DELETE CASCADE,
  trigger_timing TEXT NOT NULL CHECK (trigger_timing IN ('before', 'after')),
  hours_offset INTEGER NOT NULL DEFAULT 1, -- hours before/after meeting
  meeting_type TEXT -- filter by meeting type, NULL = all meetings
);

-- Junction table for attaching key results to automation messages
CREATE TABLE IF NOT EXISTS automation_key_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  quarterly_key_result_id UUID NOT NULL REFERENCES quarterly_key_results(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(automation_id, quarterly_key_result_id)
);

-- Add timezone column to companies if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'timezone'
  ) THEN
    ALTER TABLE companies ADD COLUMN timezone TEXT DEFAULT 'Europe/Amsterdam';
  END IF;
END $$;

-- Enable RLS
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_recurring_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_meeting_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_key_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies for automations (coach-only access)
CREATE POLICY "automations_select_coach" ON automations
  FOR SELECT USING (
    coach_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM company_members 
      WHERE company_members.company_id = automations.company_id 
      AND company_members.user_id = auth.uid()
      AND company_members.role = 'coach'
    )
  );

CREATE POLICY "automations_insert_coach" ON automations
  FOR INSERT WITH CHECK (
    coach_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM company_members 
      WHERE company_members.company_id = automations.company_id 
      AND company_members.user_id = auth.uid()
      AND company_members.role = 'coach'
    )
  );

CREATE POLICY "automations_update_coach" ON automations
  FOR UPDATE USING (
    coach_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM company_members 
      WHERE company_members.company_id = automations.company_id 
      AND company_members.user_id = auth.uid()
      AND company_members.role = 'coach'
    )
  );

CREATE POLICY "automations_delete_coach" ON automations
  FOR DELETE USING (
    coach_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM company_members 
      WHERE company_members.company_id = automations.company_id 
      AND company_members.user_id = auth.uid()
      AND company_members.role = 'coach'
    )
  );

-- RLS for automation_recurring_config (inherit from parent automation)
CREATE POLICY "recurring_config_select" ON automation_recurring_config
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM automations 
      WHERE automations.id = automation_recurring_config.automation_id
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

CREATE POLICY "recurring_config_insert" ON automation_recurring_config
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM automations 
      WHERE automations.id = automation_recurring_config.automation_id
      AND automations.coach_id = auth.uid()
    )
  );

CREATE POLICY "recurring_config_update" ON automation_recurring_config
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM automations 
      WHERE automations.id = automation_recurring_config.automation_id
      AND automations.coach_id = auth.uid()
    )
  );

CREATE POLICY "recurring_config_delete" ON automation_recurring_config
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM automations 
      WHERE automations.id = automation_recurring_config.automation_id
      AND automations.coach_id = auth.uid()
    )
  );

-- RLS for automation_meeting_config (inherit from parent automation)
CREATE POLICY "meeting_config_select" ON automation_meeting_config
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM automations 
      WHERE automations.id = automation_meeting_config.automation_id
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

CREATE POLICY "meeting_config_insert" ON automation_meeting_config
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM automations 
      WHERE automations.id = automation_meeting_config.automation_id
      AND automations.coach_id = auth.uid()
    )
  );

CREATE POLICY "meeting_config_update" ON automation_meeting_config
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM automations 
      WHERE automations.id = automation_meeting_config.automation_id
      AND automations.coach_id = auth.uid()
    )
  );

CREATE POLICY "meeting_config_delete" ON automation_meeting_config
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM automations 
      WHERE automations.id = automation_meeting_config.automation_id
      AND automations.coach_id = auth.uid()
    )
  );

-- RLS for automation_key_results (inherit from parent automation)
CREATE POLICY "automation_kr_select" ON automation_key_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM automations 
      WHERE automations.id = automation_key_results.automation_id
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

CREATE POLICY "automation_kr_insert" ON automation_key_results
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM automations 
      WHERE automations.id = automation_key_results.automation_id
      AND automations.coach_id = auth.uid()
    )
  );

CREATE POLICY "automation_kr_delete" ON automation_key_results
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM automations 
      WHERE automations.id = automation_key_results.automation_id
      AND automations.coach_id = auth.uid()
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_automations_company_id ON automations(company_id);
CREATE INDEX IF NOT EXISTS idx_automations_coach_id ON automations(coach_id);
CREATE INDEX IF NOT EXISTS idx_automations_is_active ON automations(is_active);
CREATE INDEX IF NOT EXISTS idx_automation_recurring_config_automation_id ON automation_recurring_config(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_meeting_config_automation_id ON automation_meeting_config(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_key_results_automation_id ON automation_key_results(automation_id);
