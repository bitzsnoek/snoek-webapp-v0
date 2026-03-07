-- Add INSERT and UPDATE policies for meetings table (needed for sync)
CREATE POLICY "meetings_insert" ON meetings
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid() AND role = 'coach'
    )
  );

CREATE POLICY "meetings_update" ON meetings
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid() AND role = 'coach'
    )
  );

CREATE POLICY "meetings_delete" ON meetings
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid() AND role = 'coach'
    )
  );
