-- Custom Goals Feature - Phase 1 Migration
-- Creates tables for custom goal boards, goals, and check-ins

-- 1. Add feature flag to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS custom_goals_enabled BOOLEAN DEFAULT false;

-- 2. Create custom_goal_boards table
CREATE TABLE IF NOT EXISTS custom_goal_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  board_type TEXT NOT NULL CHECK (board_type IN ('weekly', 'monthly')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create custom_goals table
CREATE TABLE IF NOT EXISTS custom_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES custom_goal_boards(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('number', 'percentage', 'currency', 'boolean', 'text')),
  target_value NUMERIC,
  current_value NUMERIC DEFAULT 0,
  unit TEXT,
  owner_id UUID REFERENCES company_members(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create custom_goal_checkins table
CREATE TABLE IF NOT EXISTS custom_goal_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES custom_goals(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL,
  value NUMERIC,
  note TEXT,
  created_by UUID REFERENCES company_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(goal_id, checkin_date)
);

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_custom_goal_boards_company ON custom_goal_boards(company_id);
CREATE INDEX IF NOT EXISTS idx_custom_goal_boards_type ON custom_goal_boards(board_type);
CREATE INDEX IF NOT EXISTS idx_custom_goal_boards_dates ON custom_goal_boards(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_custom_goals_board ON custom_goals(board_id);
CREATE INDEX IF NOT EXISTS idx_custom_goals_company ON custom_goals(company_id);
CREATE INDEX IF NOT EXISTS idx_custom_goals_owner ON custom_goals(owner_id);
CREATE INDEX IF NOT EXISTS idx_custom_goal_checkins_goal ON custom_goal_checkins(goal_id);
CREATE INDEX IF NOT EXISTS idx_custom_goal_checkins_date ON custom_goal_checkins(checkin_date);

-- 6. Enable RLS
ALTER TABLE custom_goal_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_goal_checkins ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for custom_goal_boards
CREATE POLICY custom_goal_boards_select ON custom_goal_boards
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY custom_goal_boards_insert ON custom_goal_boards
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY custom_goal_boards_update ON custom_goal_boards
  FOR UPDATE USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY custom_goal_boards_delete ON custom_goal_boards
  FOR DELETE USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

-- 8. RLS Policies for custom_goals
CREATE POLICY custom_goals_select ON custom_goals
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY custom_goals_insert ON custom_goals
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY custom_goals_update ON custom_goals
  FOR UPDATE USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY custom_goals_delete ON custom_goals
  FOR DELETE USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

-- 9. RLS Policies for custom_goal_checkins
CREATE POLICY custom_goal_checkins_select ON custom_goal_checkins
  FOR SELECT USING (
    goal_id IN (
      SELECT cg.id FROM custom_goals cg
      WHERE cg.company_id IN (
        SELECT company_id FROM company_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY custom_goal_checkins_insert ON custom_goal_checkins
  FOR INSERT WITH CHECK (
    goal_id IN (
      SELECT cg.id FROM custom_goals cg
      WHERE cg.company_id IN (
        SELECT company_id FROM company_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY custom_goal_checkins_update ON custom_goal_checkins
  FOR UPDATE USING (
    goal_id IN (
      SELECT cg.id FROM custom_goals cg
      WHERE cg.company_id IN (
        SELECT company_id FROM company_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY custom_goal_checkins_delete ON custom_goal_checkins
  FOR DELETE USING (
    goal_id IN (
      SELECT cg.id FROM custom_goals cg
      WHERE cg.company_id IN (
        SELECT company_id FROM company_members WHERE user_id = auth.uid()
      )
    )
  );

-- 10. Function to update current_value on custom_goals when checkins change
CREATE OR REPLACE FUNCTION update_custom_goal_current_value()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the current_value to be the sum of all check-in values for this goal
  UPDATE custom_goals
  SET current_value = COALESCE((
    SELECT SUM(value) FROM custom_goal_checkins WHERE goal_id = COALESCE(NEW.goal_id, OLD.goal_id)
  ), 0),
  updated_at = now()
  WHERE id = COALESCE(NEW.goal_id, OLD.goal_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Trigger to auto-update current_value
DROP TRIGGER IF EXISTS trigger_update_custom_goal_current_value ON custom_goal_checkins;
CREATE TRIGGER trigger_update_custom_goal_current_value
  AFTER INSERT OR UPDATE OR DELETE ON custom_goal_checkins
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_goal_current_value();

-- 12. Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_custom_goals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 13. Triggers for updated_at
DROP TRIGGER IF EXISTS trigger_custom_goal_boards_updated_at ON custom_goal_boards;
CREATE TRIGGER trigger_custom_goal_boards_updated_at
  BEFORE UPDATE ON custom_goal_boards
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_goals_updated_at();

DROP TRIGGER IF EXISTS trigger_custom_goals_updated_at ON custom_goals;
CREATE TRIGGER trigger_custom_goals_updated_at
  BEFORE UPDATE ON custom_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_goals_updated_at();

DROP TRIGGER IF EXISTS trigger_custom_goal_checkins_updated_at ON custom_goal_checkins;
CREATE TRIGGER trigger_custom_goal_checkins_updated_at
  BEFORE UPDATE ON custom_goal_checkins
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_goals_updated_at();
