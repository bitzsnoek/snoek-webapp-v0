-- Add emails array column to company_members for storing multiple email addresses per founder
ALTER TABLE company_members
ADD COLUMN IF NOT EXISTS emails TEXT[] DEFAULT '{}';

-- Create index for searching emails
CREATE INDEX IF NOT EXISTS idx_company_members_emails ON company_members USING GIN (emails);
