-- Add position columns for ordering goals and key results
-- This migration adds position columns to enable manual reordering

-- Add position to yearly_goals
ALTER TABLE yearly_goals ADD COLUMN IF NOT EXISTS position integer DEFAULT 0;

-- Add position to yearly_key_results
ALTER TABLE yearly_key_results ADD COLUMN IF NOT EXISTS position integer DEFAULT 0;

-- Add position to quarterly_goals
ALTER TABLE quarterly_goals ADD COLUMN IF NOT EXISTS position integer DEFAULT 0;

-- Add position to quarterly_key_results
ALTER TABLE quarterly_key_results ADD COLUMN IF NOT EXISTS position integer DEFAULT 0;

-- Initialize positions based on current order (by created_at)
WITH numbered_yearly_goals AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY company_id, year ORDER BY created_at) - 1 AS pos
  FROM yearly_goals
)
UPDATE yearly_goals
SET position = numbered_yearly_goals.pos
FROM numbered_yearly_goals
WHERE yearly_goals.id = numbered_yearly_goals.id;

WITH numbered_yearly_krs AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY yearly_goal_id ORDER BY created_at) - 1 AS pos
  FROM yearly_key_results
)
UPDATE yearly_key_results
SET position = numbered_yearly_krs.pos
FROM numbered_yearly_krs
WHERE yearly_key_results.id = numbered_yearly_krs.id;

WITH numbered_quarterly_goals AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY company_id, year, quarter ORDER BY created_at) - 1 AS pos
  FROM quarterly_goals
)
UPDATE quarterly_goals
SET position = numbered_quarterly_goals.pos
FROM numbered_quarterly_goals
WHERE quarterly_goals.id = numbered_quarterly_goals.id;

WITH numbered_quarterly_krs AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY quarterly_goal_id ORDER BY created_at) - 1 AS pos
  FROM quarterly_key_results
)
UPDATE quarterly_key_results
SET position = numbered_quarterly_krs.pos
FROM numbered_quarterly_krs
WHERE quarterly_key_results.id = numbered_quarterly_krs.id;
