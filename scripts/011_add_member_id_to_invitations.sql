-- Add member_id column to invitations so we can link an invite to a specific founder/member
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES company_members(id) ON DELETE SET NULL;
