-- Fix: infinite recursion in company_members RLS policies
-- The problem: company_members policies reference company_members in a subquery,
-- causing infinite recursion. The fix: use a SECURITY DEFINER function that
-- bypasses RLS to look up company IDs for the current user.

-- Step 1: Create a helper function that bypasses RLS
CREATE OR REPLACE FUNCTION public.get_user_company_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT company_id FROM public.company_members WHERE user_id = auth.uid();
$$;

-- Step 2: Drop ALL existing policies on company_members
DROP POLICY IF EXISTS "company_members_select" ON company_members;
DROP POLICY IF EXISTS "company_members_insert" ON company_members;
DROP POLICY IF EXISTS "company_members_update" ON company_members;
DROP POLICY IF EXISTS "company_members_delete" ON company_members;

-- Step 3: Recreate company_members policies using the helper function
CREATE POLICY "company_members_select" ON company_members
  FOR SELECT USING (company_id IN (SELECT get_user_company_ids()));

CREATE POLICY "company_members_insert" ON company_members
  FOR INSERT WITH CHECK (company_id IN (SELECT get_user_company_ids()));

CREATE POLICY "company_members_update" ON company_members
  FOR UPDATE USING (company_id IN (SELECT get_user_company_ids()));

CREATE POLICY "company_members_delete" ON company_members
  FOR DELETE USING (company_id IN (SELECT get_user_company_ids()));

-- Step 4: Fix companies SELECT policy (it also referenced company_members directly)
DROP POLICY IF EXISTS "companies_select_member" ON companies;
CREATE POLICY "companies_select_member" ON companies
  FOR SELECT USING (id IN (SELECT get_user_company_ids()));

-- Step 5: Fix all other table policies that had the same subquery pattern
-- yearly_goals
DROP POLICY IF EXISTS "yearly_goals_select" ON yearly_goals;
DROP POLICY IF EXISTS "yearly_goals_insert" ON yearly_goals;
DROP POLICY IF EXISTS "yearly_goals_update" ON yearly_goals;
DROP POLICY IF EXISTS "yearly_goals_delete" ON yearly_goals;
CREATE POLICY "yearly_goals_select" ON yearly_goals FOR SELECT USING (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "yearly_goals_insert" ON yearly_goals FOR INSERT WITH CHECK (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "yearly_goals_update" ON yearly_goals FOR UPDATE USING (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "yearly_goals_delete" ON yearly_goals FOR DELETE USING (company_id IN (SELECT get_user_company_ids()));

-- quarterly_goals
DROP POLICY IF EXISTS "quarterly_goals_select" ON quarterly_goals;
DROP POLICY IF EXISTS "quarterly_goals_insert" ON quarterly_goals;
DROP POLICY IF EXISTS "quarterly_goals_update" ON quarterly_goals;
DROP POLICY IF EXISTS "quarterly_goals_delete" ON quarterly_goals;
CREATE POLICY "quarterly_goals_select" ON quarterly_goals FOR SELECT USING (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "quarterly_goals_insert" ON quarterly_goals FOR INSERT WITH CHECK (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "quarterly_goals_update" ON quarterly_goals FOR UPDATE USING (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "quarterly_goals_delete" ON quarterly_goals FOR DELETE USING (company_id IN (SELECT get_user_company_ids()));

-- yearly_key_results (via yearly_goals)
DROP POLICY IF EXISTS "yearly_key_results_select" ON yearly_key_results;
DROP POLICY IF EXISTS "yearly_key_results_insert" ON yearly_key_results;
DROP POLICY IF EXISTS "yearly_key_results_update" ON yearly_key_results;
DROP POLICY IF EXISTS "yearly_key_results_delete" ON yearly_key_results;
CREATE POLICY "yearly_key_results_select" ON yearly_key_results FOR SELECT USING (
  yearly_goal_id IN (SELECT id FROM yearly_goals WHERE company_id IN (SELECT get_user_company_ids()))
);
CREATE POLICY "yearly_key_results_insert" ON yearly_key_results FOR INSERT WITH CHECK (
  yearly_goal_id IN (SELECT id FROM yearly_goals WHERE company_id IN (SELECT get_user_company_ids()))
);
CREATE POLICY "yearly_key_results_update" ON yearly_key_results FOR UPDATE USING (
  yearly_goal_id IN (SELECT id FROM yearly_goals WHERE company_id IN (SELECT get_user_company_ids()))
);
CREATE POLICY "yearly_key_results_delete" ON yearly_key_results FOR DELETE USING (
  yearly_goal_id IN (SELECT id FROM yearly_goals WHERE company_id IN (SELECT get_user_company_ids()))
);

-- quarterly_key_results (via quarterly_goals)
DROP POLICY IF EXISTS "quarterly_key_results_select" ON quarterly_key_results;
DROP POLICY IF EXISTS "quarterly_key_results_insert" ON quarterly_key_results;
DROP POLICY IF EXISTS "quarterly_key_results_update" ON quarterly_key_results;
DROP POLICY IF EXISTS "quarterly_key_results_delete" ON quarterly_key_results;
CREATE POLICY "quarterly_key_results_select" ON quarterly_key_results FOR SELECT USING (
  quarterly_goal_id IN (SELECT id FROM quarterly_goals WHERE company_id IN (SELECT get_user_company_ids()))
);
CREATE POLICY "quarterly_key_results_insert" ON quarterly_key_results FOR INSERT WITH CHECK (
  quarterly_goal_id IN (SELECT id FROM quarterly_goals WHERE company_id IN (SELECT get_user_company_ids()))
);
CREATE POLICY "quarterly_key_results_update" ON quarterly_key_results FOR UPDATE USING (
  quarterly_goal_id IN (SELECT id FROM quarterly_goals WHERE company_id IN (SELECT get_user_company_ids()))
);
CREATE POLICY "quarterly_key_results_delete" ON quarterly_key_results FOR DELETE USING (
  quarterly_goal_id IN (SELECT id FROM quarterly_goals WHERE company_id IN (SELECT get_user_company_ids()))
);

-- weekly_values (via quarterly_key_results -> quarterly_goals)
DROP POLICY IF EXISTS "weekly_values_select" ON weekly_values;
DROP POLICY IF EXISTS "weekly_values_insert" ON weekly_values;
DROP POLICY IF EXISTS "weekly_values_update" ON weekly_values;
DROP POLICY IF EXISTS "weekly_values_delete" ON weekly_values;
CREATE POLICY "weekly_values_select" ON weekly_values FOR SELECT USING (
  quarterly_key_result_id IN (
    SELECT id FROM quarterly_key_results WHERE quarterly_goal_id IN (
      SELECT id FROM quarterly_goals WHERE company_id IN (SELECT get_user_company_ids())
    )
  )
);
CREATE POLICY "weekly_values_insert" ON weekly_values FOR INSERT WITH CHECK (
  quarterly_key_result_id IN (
    SELECT id FROM quarterly_key_results WHERE quarterly_goal_id IN (
      SELECT id FROM quarterly_goals WHERE company_id IN (SELECT get_user_company_ids())
    )
  )
);
CREATE POLICY "weekly_values_update" ON weekly_values FOR UPDATE USING (
  quarterly_key_result_id IN (
    SELECT id FROM quarterly_key_results WHERE quarterly_goal_id IN (
      SELECT id FROM quarterly_goals WHERE company_id IN (SELECT get_user_company_ids())
    )
  )
);
CREATE POLICY "weekly_values_delete" ON weekly_values FOR DELETE USING (
  quarterly_key_result_id IN (
    SELECT id FROM quarterly_key_results WHERE quarterly_goal_id IN (
      SELECT id FROM quarterly_goals WHERE company_id IN (SELECT get_user_company_ids())
    )
  )
);

-- metrics
DROP POLICY IF EXISTS "metrics_select" ON metrics;
DROP POLICY IF EXISTS "metrics_insert" ON metrics;
DROP POLICY IF EXISTS "metrics_update" ON metrics;
DROP POLICY IF EXISTS "metrics_delete" ON metrics;
CREATE POLICY "metrics_select" ON metrics FOR SELECT USING (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "metrics_insert" ON metrics FOR INSERT WITH CHECK (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "metrics_update" ON metrics FOR UPDATE USING (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "metrics_delete" ON metrics FOR DELETE USING (company_id IN (SELECT get_user_company_ids()));

-- metric_values (via metrics)
DROP POLICY IF EXISTS "metric_values_select" ON metric_values;
DROP POLICY IF EXISTS "metric_values_insert" ON metric_values;
DROP POLICY IF EXISTS "metric_values_update" ON metric_values;
DROP POLICY IF EXISTS "metric_values_delete" ON metric_values;
CREATE POLICY "metric_values_select" ON metric_values FOR SELECT USING (
  metric_id IN (SELECT id FROM metrics WHERE company_id IN (SELECT get_user_company_ids()))
);
CREATE POLICY "metric_values_insert" ON metric_values FOR INSERT WITH CHECK (
  metric_id IN (SELECT id FROM metrics WHERE company_id IN (SELECT get_user_company_ids()))
);
CREATE POLICY "metric_values_update" ON metric_values FOR UPDATE USING (
  metric_id IN (SELECT id FROM metrics WHERE company_id IN (SELECT get_user_company_ids()))
);
CREATE POLICY "metric_values_delete" ON metric_values FOR DELETE USING (
  metric_id IN (SELECT id FROM metrics WHERE company_id IN (SELECT get_user_company_ids()))
);
