-- Enable realtime for goal-related tables
-- This allows postgres_changes to work for these tables

-- Add tables to supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE quarterly_goals;
ALTER PUBLICATION supabase_realtime ADD TABLE quarterly_key_results;
ALTER PUBLICATION supabase_realtime ADD TABLE yearly_goals;
ALTER PUBLICATION supabase_realtime ADD TABLE yearly_key_results;
ALTER PUBLICATION supabase_realtime ADD TABLE weekly_values;

-- Set replica identity to full for these tables so we get old values in updates
ALTER TABLE quarterly_goals REPLICA IDENTITY FULL;
ALTER TABLE quarterly_key_results REPLICA IDENTITY FULL;
ALTER TABLE yearly_goals REPLICA IDENTITY FULL;
ALTER TABLE yearly_key_results REPLICA IDENTITY FULL;
ALTER TABLE weekly_values REPLICA IDENTITY FULL;
