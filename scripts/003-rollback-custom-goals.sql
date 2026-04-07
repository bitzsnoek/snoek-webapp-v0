-- Rollback custom goals feature
-- Drop all custom goals related tables and columns

-- Drop triggers first
DROP TRIGGER IF EXISTS update_custom_goal_current_value ON custom_goal_checkins;
DROP FUNCTION IF EXISTS update_custom_goal_current_value();

-- Drop tables (order matters due to foreign keys)
DROP TABLE IF EXISTS custom_goal_checkins;
DROP TABLE IF EXISTS custom_goals;
DROP TABLE IF EXISTS custom_goal_groups;
DROP TABLE IF EXISTS custom_goal_boards;

-- Remove custom_goals_enabled column from companies
ALTER TABLE companies DROP COLUMN IF EXISTS custom_goals_enabled;
