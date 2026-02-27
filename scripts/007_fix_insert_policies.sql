-- Fix company_members INSERT policy to allow adding yourself to a company you coach
-- The old policy required the company to already be in get_user_company_ids() which is 
-- a chicken-and-egg problem when creating the first member

DROP POLICY IF EXISTS "company_members_insert" ON company_members;

CREATE POLICY "company_members_insert" ON company_members
  FOR INSERT TO authenticated
  WITH CHECK (
    -- You can add members to companies you coach (you are the coach_id on the company)
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = company_id AND c.coach_id = auth.uid()
    )
    OR
    -- Or you can add yourself as a member
    user_id = auth.uid()
  );
