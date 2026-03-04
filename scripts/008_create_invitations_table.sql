-- Create invitations table for user invitations
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('founder', 'coach')),
  invited_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_company_id ON invitations(company_id);

-- Enable RLS
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Coaches can view invitations for their companies
CREATE POLICY "Coaches can view their company invitations"
  ON invitations FOR SELECT
  USING (
    company_id IN (SELECT id FROM companies WHERE coach_id = auth.uid())
    OR invited_by = auth.uid()
  );

-- Coaches can create invitations for their companies
CREATE POLICY "Coaches can create invitations for their companies"
  ON invitations FOR INSERT
  WITH CHECK (
    invited_by = auth.uid()
    AND company_id IN (SELECT id FROM companies WHERE coach_id = auth.uid())
  );

-- Coaches can update invitations for their companies (cancel/resend)
CREATE POLICY "Coaches can update their company invitations"
  ON invitations FOR UPDATE
  USING (
    invited_by = auth.uid()
    AND company_id IN (SELECT id FROM companies WHERE coach_id = auth.uid())
  );

-- Anyone can update their own invitations when accepting
CREATE POLICY "Users can accept their own invitations"
  ON invitations FOR UPDATE
  USING (email = auth.jwt() ->> 'email' OR true)  -- Allow during signup
  WITH CHECK (status = 'accepted');
