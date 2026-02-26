-- Make user_id nullable (not all founders have auth accounts)
ALTER TABLE company_members ALTER COLUMN user_id DROP NOT NULL;

-- Drop the old unique constraint and replace with one that allows multiple NULL user_ids
ALTER TABLE company_members DROP CONSTRAINT IF EXISTS company_members_company_id_user_id_key;

-- Clean up any partial seed data from failed run
DELETE FROM weekly_values;
DELETE FROM key_results;
DELETE FROM quarterly_goals;
DELETE FROM yearly_goals;
DELETE FROM metrics;
DELETE FROM company_members;
DELETE FROM companies;
