-- Add DELETE policy for invitations (was missing, causing cancel to silently fail)
CREATE POLICY "Coaches can delete their company invitations"
  ON invitations FOR DELETE
  USING (
    invited_by = auth.uid()
    AND company_id IN (SELECT id FROM companies WHERE coach_id = auth.uid())
  );
