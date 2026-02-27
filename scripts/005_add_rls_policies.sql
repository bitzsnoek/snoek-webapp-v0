-- Add missing SELECT policies for tables that don't have them
-- and add INSERT/UPDATE/DELETE policies for all data tables

-- ============================================================
-- weekly_values: SELECT, INSERT, UPDATE, DELETE via quarterly_key_results -> quarterly_goals -> company_members
-- ============================================================
CREATE POLICY "weekly_values_select" ON weekly_values FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM quarterly_key_results qkr
    JOIN quarterly_goals qg ON qg.id = qkr.quarterly_goal_id
    JOIN company_members cm ON cm.company_id = qg.company_id
    WHERE qkr.id = weekly_values.quarterly_key_result_id AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "weekly_values_insert" ON weekly_values FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM quarterly_key_results qkr
    JOIN quarterly_goals qg ON qg.id = qkr.quarterly_goal_id
    JOIN company_members cm ON cm.company_id = qg.company_id
    WHERE qkr.id = weekly_values.quarterly_key_result_id AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "weekly_values_update" ON weekly_values FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM quarterly_key_results qkr
    JOIN quarterly_goals qg ON qg.id = qkr.quarterly_goal_id
    JOIN company_members cm ON cm.company_id = qg.company_id
    WHERE qkr.id = weekly_values.quarterly_key_result_id AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "weekly_values_delete" ON weekly_values FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM quarterly_key_results qkr
    JOIN quarterly_goals qg ON qg.id = qkr.quarterly_goal_id
    JOIN company_members cm ON cm.company_id = qg.company_id
    WHERE qkr.id = weekly_values.quarterly_key_result_id AND cm.user_id = auth.uid()
  )
);

-- ============================================================
-- metric_values: SELECT, INSERT, UPDATE, DELETE via metrics -> company_members
-- ============================================================
CREATE POLICY "metric_values_select" ON metric_values FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM metrics m
    JOIN company_members cm ON cm.company_id = m.company_id
    WHERE m.id = metric_values.metric_id AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "metric_values_insert" ON metric_values FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM metrics m
    JOIN company_members cm ON cm.company_id = m.company_id
    WHERE m.id = metric_values.metric_id AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "metric_values_update" ON metric_values FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM metrics m
    JOIN company_members cm ON cm.company_id = m.company_id
    WHERE m.id = metric_values.metric_id AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "metric_values_delete" ON metric_values FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM metrics m
    JOIN company_members cm ON cm.company_id = m.company_id
    WHERE m.id = metric_values.metric_id AND cm.user_id = auth.uid()
  )
);

-- ============================================================
-- yearly_key_results: SELECT, INSERT, UPDATE, DELETE via yearly_goals -> company_members
-- ============================================================
CREATE POLICY "yearly_key_results_select" ON yearly_key_results FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM yearly_goals yg
    JOIN company_members cm ON cm.company_id = yg.company_id
    WHERE yg.id = yearly_key_results.yearly_goal_id AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "yearly_key_results_insert" ON yearly_key_results FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM yearly_goals yg
    JOIN company_members cm ON cm.company_id = yg.company_id
    WHERE yg.id = yearly_key_results.yearly_goal_id AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "yearly_key_results_update" ON yearly_key_results FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM yearly_goals yg
    JOIN company_members cm ON cm.company_id = yg.company_id
    WHERE yg.id = yearly_key_results.yearly_goal_id AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "yearly_key_results_delete" ON yearly_key_results FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM yearly_goals yg
    JOIN company_members cm ON cm.company_id = yg.company_id
    WHERE yg.id = yearly_key_results.yearly_goal_id AND cm.user_id = auth.uid()
  )
);

-- ============================================================
-- Add INSERT/UPDATE/DELETE for tables that only have SELECT
-- ============================================================

-- company_members: INSERT, UPDATE, DELETE (members of same company)
CREATE POLICY "company_members_insert" ON company_members FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM company_members cm
    WHERE cm.company_id = company_members.company_id AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "company_members_update" ON company_members FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM company_members cm
    WHERE cm.company_id = company_members.company_id AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "company_members_delete" ON company_members FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM company_members cm
    WHERE cm.company_id = company_members.company_id AND cm.user_id = auth.uid()
  )
);

-- quarterly_goals: INSERT, UPDATE, DELETE
CREATE POLICY "quarterly_goals_insert" ON quarterly_goals FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM company_members cm
    WHERE cm.company_id = quarterly_goals.company_id AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "quarterly_goals_update" ON quarterly_goals FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM company_members cm
    WHERE cm.company_id = quarterly_goals.company_id AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "quarterly_goals_delete" ON quarterly_goals FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM company_members cm
    WHERE cm.company_id = quarterly_goals.company_id AND cm.user_id = auth.uid()
  )
);

-- quarterly_key_results: INSERT, UPDATE, DELETE
CREATE POLICY "quarterly_key_results_insert" ON quarterly_key_results FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM quarterly_goals qg
    JOIN company_members cm ON cm.company_id = qg.company_id
    WHERE qg.id = quarterly_key_results.quarterly_goal_id AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "quarterly_key_results_update" ON quarterly_key_results FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM quarterly_goals qg
    JOIN company_members cm ON cm.company_id = qg.company_id
    WHERE qg.id = quarterly_key_results.quarterly_goal_id AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "quarterly_key_results_delete" ON quarterly_key_results FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM quarterly_goals qg
    JOIN company_members cm ON cm.company_id = qg.company_id
    WHERE qg.id = quarterly_key_results.quarterly_goal_id AND cm.user_id = auth.uid()
  )
);

-- yearly_goals: INSERT, UPDATE, DELETE
CREATE POLICY "yearly_goals_insert" ON yearly_goals FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM company_members cm
    WHERE cm.company_id = yearly_goals.company_id AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "yearly_goals_update" ON yearly_goals FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM company_members cm
    WHERE cm.company_id = yearly_goals.company_id AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "yearly_goals_delete" ON yearly_goals FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM company_members cm
    WHERE cm.company_id = yearly_goals.company_id AND cm.user_id = auth.uid()
  )
);

-- metrics: INSERT, UPDATE, DELETE
CREATE POLICY "metrics_insert" ON metrics FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM company_members cm
    WHERE cm.company_id = metrics.company_id AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "metrics_update" ON metrics FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM company_members cm
    WHERE cm.company_id = metrics.company_id AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "metrics_delete" ON metrics FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM company_members cm
    WHERE cm.company_id = metrics.company_id AND cm.user_id = auth.uid()
  )
);
