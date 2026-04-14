-- =============================================================================
-- Terminology Rename Migration
-- Company → Client, Founder → Member
--
-- Uses ALTER TABLE ... RENAME (instant, no data copy)
-- Run via Supabase Dashboard SQL Editor
-- =============================================================================

BEGIN;

-- =============================================================================
-- Step 1: Rename tables
-- =============================================================================

ALTER TABLE public.companies RENAME TO clients;
ALTER TABLE public.company_members RENAME TO client_members;
ALTER TABLE public.automation_founders RENAME TO automation_members;

-- =============================================================================
-- Step 2: Rename columns
-- =============================================================================

-- client_members (was company_members)
ALTER TABLE public.client_members RENAME COLUMN company_id TO client_id;

-- invitations
ALTER TABLE public.invitations RENAME COLUMN company_id TO client_id;

-- yearly_goals
ALTER TABLE public.yearly_goals RENAME COLUMN company_id TO client_id;

-- quarterly_goals
ALTER TABLE public.quarterly_goals RENAME COLUMN company_id TO client_id;

-- metrics
ALTER TABLE public.metrics RENAME COLUMN company_id TO client_id;

-- conversations
ALTER TABLE public.conversations RENAME COLUMN company_id TO client_id;
ALTER TABLE public.conversations RENAME COLUMN founder_id TO member_id;

-- google_calendar_connections
ALTER TABLE public.google_calendar_connections RENAME COLUMN company_id TO client_id;

-- meetings
ALTER TABLE public.meetings RENAME COLUMN company_id TO client_id;
ALTER TABLE public.meetings RENAME COLUMN founder_ids TO member_ids;

-- automations
ALTER TABLE public.automations RENAME COLUMN company_id TO client_id;

-- goal_boards
ALTER TABLE public.goal_boards RENAME COLUMN company_id TO client_id;

-- automation_members (was automation_founders)
ALTER TABLE public.automation_members RENAME COLUMN founder_member_id TO member_id;

-- =============================================================================
-- Step 3: Update role values
-- =============================================================================

-- Default value on client_members.role
ALTER TABLE public.client_members ALTER COLUMN role SET DEFAULT 'member'::text;

-- Drop check constraint BEFORE updating data (constraint only allows old values)
ALTER TABLE public.invitations DROP CONSTRAINT IF EXISTS invitations_role_check;

-- Update existing data
UPDATE public.client_members SET role = 'member' WHERE role = 'founder';
UPDATE public.invitations SET role = 'member' WHERE role = 'founder';

-- Re-add check constraint with new values
ALTER TABLE public.invitations ADD CONSTRAINT invitations_role_check CHECK (role = ANY (ARRAY['member'::text, 'coach'::text]));

-- =============================================================================
-- Step 4: Drop ALL existing RLS policies FIRST (they depend on old functions)
-- =============================================================================

-- clients (was companies)
DROP POLICY IF EXISTS companies_select_member ON public.clients;
DROP POLICY IF EXISTS companies_insert_coach ON public.clients;
DROP POLICY IF EXISTS companies_update_coach ON public.clients;
DROP POLICY IF EXISTS companies_delete_coach ON public.clients;

-- client_members (was company_members)
DROP POLICY IF EXISTS company_members_select ON public.client_members;
DROP POLICY IF EXISTS company_members_insert ON public.client_members;
DROP POLICY IF EXISTS company_members_update ON public.client_members;
DROP POLICY IF EXISTS company_members_delete ON public.client_members;

-- invitations
DROP POLICY IF EXISTS "Anyone can view invitations by token" ON public.invitations;
DROP POLICY IF EXISTS "Coaches can view their company invitations" ON public.invitations;
DROP POLICY IF EXISTS "Coaches can create invitations for their companies" ON public.invitations;
DROP POLICY IF EXISTS "Coaches can update their company invitations" ON public.invitations;
DROP POLICY IF EXISTS "Users can accept their own invitations" ON public.invitations;
DROP POLICY IF EXISTS "Coaches can delete their company invitations" ON public.invitations;

-- yearly_goals
DROP POLICY IF EXISTS yearly_goals_select ON public.yearly_goals;
DROP POLICY IF EXISTS yearly_goals_insert ON public.yearly_goals;
DROP POLICY IF EXISTS yearly_goals_update ON public.yearly_goals;
DROP POLICY IF EXISTS yearly_goals_delete ON public.yearly_goals;

-- yearly_key_results
DROP POLICY IF EXISTS yearly_key_results_select ON public.yearly_key_results;
DROP POLICY IF EXISTS yearly_key_results_insert ON public.yearly_key_results;
DROP POLICY IF EXISTS yearly_key_results_update ON public.yearly_key_results;
DROP POLICY IF EXISTS yearly_key_results_delete ON public.yearly_key_results;

-- quarterly_goals
DROP POLICY IF EXISTS quarterly_goals_select ON public.quarterly_goals;
DROP POLICY IF EXISTS quarterly_goals_insert ON public.quarterly_goals;
DROP POLICY IF EXISTS quarterly_goals_update ON public.quarterly_goals;
DROP POLICY IF EXISTS quarterly_goals_delete ON public.quarterly_goals;

-- quarterly_key_results
DROP POLICY IF EXISTS quarterly_key_results_select ON public.quarterly_key_results;
DROP POLICY IF EXISTS quarterly_key_results_insert ON public.quarterly_key_results;
DROP POLICY IF EXISTS quarterly_key_results_update ON public.quarterly_key_results;
DROP POLICY IF EXISTS quarterly_key_results_delete ON public.quarterly_key_results;

-- weekly_values
DROP POLICY IF EXISTS weekly_values_select ON public.weekly_values;
DROP POLICY IF EXISTS weekly_values_insert ON public.weekly_values;
DROP POLICY IF EXISTS weekly_values_update ON public.weekly_values;
DROP POLICY IF EXISTS weekly_values_delete ON public.weekly_values;

-- metrics
DROP POLICY IF EXISTS metrics_select ON public.metrics;
DROP POLICY IF EXISTS metrics_insert ON public.metrics;
DROP POLICY IF EXISTS metrics_update ON public.metrics;
DROP POLICY IF EXISTS metrics_delete ON public.metrics;

-- metric_values
DROP POLICY IF EXISTS metric_values_select ON public.metric_values;
DROP POLICY IF EXISTS metric_values_insert ON public.metric_values;
DROP POLICY IF EXISTS metric_values_update ON public.metric_values;
DROP POLICY IF EXISTS metric_values_delete ON public.metric_values;

-- conversations
DROP POLICY IF EXISTS conversations_select_participant ON public.conversations;
DROP POLICY IF EXISTS conversations_insert_coach ON public.conversations;

-- messages
DROP POLICY IF EXISTS messages_select_participant ON public.messages;
DROP POLICY IF EXISTS messages_insert_participant ON public.messages;

-- message_key_results
DROP POLICY IF EXISTS message_key_results_select ON public.message_key_results;
DROP POLICY IF EXISTS message_key_results_insert ON public.message_key_results;

-- message_standard_goals
DROP POLICY IF EXISTS message_standard_goals_select ON public.message_standard_goals;
DROP POLICY IF EXISTS message_standard_goals_insert ON public.message_standard_goals;

-- push_tokens (no company refs, but recreate for consistency)
-- Actually push_tokens policies don't reference company, skip

-- google_calendar_connections
DROP POLICY IF EXISTS google_calendar_connections_select ON public.google_calendar_connections;
DROP POLICY IF EXISTS google_calendar_connections_insert ON public.google_calendar_connections;
DROP POLICY IF EXISTS google_calendar_connections_update ON public.google_calendar_connections;
DROP POLICY IF EXISTS google_calendar_connections_delete ON public.google_calendar_connections;

-- meetings
DROP POLICY IF EXISTS meetings_select ON public.meetings;
DROP POLICY IF EXISTS meetings_insert ON public.meetings;
DROP POLICY IF EXISTS meetings_update ON public.meetings;
DROP POLICY IF EXISTS meetings_delete ON public.meetings;

-- meeting_documents
DROP POLICY IF EXISTS meeting_documents_select_company ON public.meeting_documents;
DROP POLICY IF EXISTS meeting_documents_insert_company ON public.meeting_documents;
DROP POLICY IF EXISTS meeting_documents_update_company ON public.meeting_documents;
DROP POLICY IF EXISTS meeting_documents_delete_company ON public.meeting_documents;

-- automations
DROP POLICY IF EXISTS automations_select_coach ON public.automations;
DROP POLICY IF EXISTS automations_insert_coach ON public.automations;
DROP POLICY IF EXISTS automations_update_coach ON public.automations;
DROP POLICY IF EXISTS automations_delete_coach ON public.automations;

-- automation_recurring_config
DROP POLICY IF EXISTS recurring_config_select ON public.automation_recurring_config;
DROP POLICY IF EXISTS recurring_config_insert ON public.automation_recurring_config;
DROP POLICY IF EXISTS recurring_config_update ON public.automation_recurring_config;
DROP POLICY IF EXISTS recurring_config_delete ON public.automation_recurring_config;

-- automation_meeting_config
DROP POLICY IF EXISTS meeting_config_select ON public.automation_meeting_config;
DROP POLICY IF EXISTS meeting_config_insert ON public.automation_meeting_config;
DROP POLICY IF EXISTS meeting_config_update ON public.automation_meeting_config;
DROP POLICY IF EXISTS meeting_config_delete ON public.automation_meeting_config;

-- automation_key_results
DROP POLICY IF EXISTS automation_kr_select ON public.automation_key_results;
DROP POLICY IF EXISTS automation_kr_insert ON public.automation_key_results;
DROP POLICY IF EXISTS automation_kr_delete ON public.automation_key_results;

-- automation_members (was automation_founders)
DROP POLICY IF EXISTS automation_founders_select ON public.automation_members;
DROP POLICY IF EXISTS automation_founders_insert ON public.automation_members;
DROP POLICY IF EXISTS automation_founders_delete ON public.automation_members;

-- automation_conversations
DROP POLICY IF EXISTS automation_conversations_select ON public.automation_conversations;
DROP POLICY IF EXISTS automation_conversations_insert ON public.automation_conversations;
DROP POLICY IF EXISTS automation_conversations_delete ON public.automation_conversations;

-- automation_scheduled_config
DROP POLICY IF EXISTS scheduled_config_select ON public.automation_scheduled_config;
DROP POLICY IF EXISTS scheduled_config_insert ON public.automation_scheduled_config;
DROP POLICY IF EXISTS scheduled_config_update ON public.automation_scheduled_config;
DROP POLICY IF EXISTS scheduled_config_delete ON public.automation_scheduled_config;
DROP POLICY IF EXISTS scheduled_config_service ON public.automation_scheduled_config;

-- automation_execution_log
DROP POLICY IF EXISTS "Service role can manage execution logs" ON public.automation_execution_log;

-- goal_boards
DROP POLICY IF EXISTS goal_boards_select ON public.goal_boards;
DROP POLICY IF EXISTS goal_boards_insert ON public.goal_boards;
DROP POLICY IF EXISTS goal_boards_update ON public.goal_boards;
DROP POLICY IF EXISTS goal_boards_delete ON public.goal_boards;

-- standard_goals
DROP POLICY IF EXISTS standard_goals_select ON public.standard_goals;
DROP POLICY IF EXISTS standard_goals_insert ON public.standard_goals;
DROP POLICY IF EXISTS standard_goals_update ON public.standard_goals;
DROP POLICY IF EXISTS standard_goals_delete ON public.standard_goals;

-- standard_goal_values
DROP POLICY IF EXISTS standard_goal_values_select ON public.standard_goal_values;
DROP POLICY IF EXISTS standard_goal_values_insert ON public.standard_goal_values;
DROP POLICY IF EXISTS standard_goal_values_update ON public.standard_goal_values;
DROP POLICY IF EXISTS standard_goal_values_delete ON public.standard_goal_values;

-- =============================================================================
-- Step 5: Drop old functions and create new ones (now safe — no policies depend on them)
-- =============================================================================

-- Drop old functions
DROP FUNCTION IF EXISTS public.get_user_company_ids();
DROP FUNCTION IF EXISTS public.get_company_members_with_email(uuid);

-- New: get_user_client_ids()
CREATE OR REPLACE FUNCTION public.get_user_client_ids()
RETURNS SETOF uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true THEN
    RETURN QUERY SELECT id FROM public.clients;
  ELSE
    RETURN QUERY SELECT client_id FROM public.client_members WHERE user_id = auth.uid();
  END IF;
END;
$$;

-- New: get_client_members_with_email()
CREATE OR REPLACE FUNCTION public.get_client_members_with_email(p_client_id uuid)
RETURNS TABLE(
  id uuid,
  client_id uuid,
  user_id uuid,
  created_at timestamp with time zone,
  role text,
  name text,
  avatar_url text,
  emails text[],
  role_title text,
  user_email character varying
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_super_admin() AND NOT EXISTS (
    SELECT 1 FROM client_members cm
    WHERE cm.client_id = p_client_id AND cm.user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM clients c
    WHERE c.id = p_client_id AND c.coach_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: You are not a member of this client';
  END IF;

  RETURN QUERY
  SELECT
    cm.id, cm.client_id, cm.user_id, cm.created_at,
    cm.role, cm.name, cm.avatar_url, cm.emails, cm.role_title,
    au.email as user_email
  FROM client_members cm
  LEFT JOIN auth.users au ON cm.user_id = au.id
  WHERE cm.client_id = p_client_id;
END;
$$;

-- =============================================================================
-- Step 6: Recreate ALL RLS policies with new names
-- =============================================================================

-- profiles (unchanged)
-- Already fine — no company/founder references

-- clients
CREATE POLICY clients_select_member ON public.clients FOR SELECT
  USING ((id IN (SELECT public.get_user_client_ids())));
CREATE POLICY clients_insert_coach ON public.clients FOR INSERT
  WITH CHECK ((auth.uid() = coach_id) OR public.is_super_admin());
CREATE POLICY clients_update_coach ON public.clients FOR UPDATE
  USING ((auth.uid() = coach_id) OR public.is_super_admin());
CREATE POLICY clients_delete_coach ON public.clients FOR DELETE
  USING ((auth.uid() = coach_id) OR public.is_super_admin());

-- client_members
CREATE POLICY client_members_select ON public.client_members FOR SELECT
  USING ((client_id IN (SELECT public.get_user_client_ids())));
CREATE POLICY client_members_insert ON public.client_members FOR INSERT TO authenticated
  WITH CHECK (
    (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_members.client_id AND c.coach_id = auth.uid()))
    OR (user_id = auth.uid())
    OR public.is_super_admin()
  );
CREATE POLICY client_members_update ON public.client_members FOR UPDATE
  USING ((client_id IN (SELECT public.get_user_client_ids())));
CREATE POLICY client_members_delete ON public.client_members FOR DELETE
  USING ((client_id IN (SELECT public.get_user_client_ids())));

-- invitations
CREATE POLICY "Anyone can view invitations by token" ON public.invitations FOR SELECT USING (true);
CREATE POLICY "Coaches can view their client invitations" ON public.invitations FOR SELECT
  USING (
    (client_id IN (SELECT clients.id FROM public.clients WHERE clients.coach_id = auth.uid()))
    OR (invited_by = auth.uid())
    OR public.is_super_admin()
  );
CREATE POLICY "Coaches can create invitations for their clients" ON public.invitations FOR INSERT
  WITH CHECK (
    ((invited_by = auth.uid()) AND (client_id IN (SELECT clients.id FROM public.clients WHERE clients.coach_id = auth.uid())))
    OR public.is_super_admin()
  );
CREATE POLICY "Coaches can update their client invitations" ON public.invitations FOR UPDATE
  USING (
    ((invited_by = auth.uid()) AND (client_id IN (SELECT clients.id FROM public.clients WHERE clients.coach_id = auth.uid())))
    OR public.is_super_admin()
  );
CREATE POLICY "Users can accept their own invitations" ON public.invitations FOR UPDATE
  USING (((email = (auth.jwt() ->> 'email'::text)) OR true)) WITH CHECK ((status = 'accepted'::text));
CREATE POLICY "Coaches can delete their client invitations" ON public.invitations FOR DELETE
  USING (
    ((invited_by = auth.uid()) AND (client_id IN (SELECT clients.id FROM public.clients WHERE clients.coach_id = auth.uid())))
    OR public.is_super_admin()
  );

-- yearly_goals
CREATE POLICY yearly_goals_select ON public.yearly_goals FOR SELECT
  USING ((client_id IN (SELECT public.get_user_client_ids())));
CREATE POLICY yearly_goals_insert ON public.yearly_goals FOR INSERT
  WITH CHECK ((client_id IN (SELECT public.get_user_client_ids())));
CREATE POLICY yearly_goals_update ON public.yearly_goals FOR UPDATE
  USING ((client_id IN (SELECT public.get_user_client_ids())));
CREATE POLICY yearly_goals_delete ON public.yearly_goals FOR DELETE
  USING ((client_id IN (SELECT public.get_user_client_ids())));

-- yearly_key_results
CREATE POLICY yearly_key_results_select ON public.yearly_key_results FOR SELECT
  USING ((yearly_goal_id IN (SELECT yg.id FROM public.yearly_goals yg WHERE yg.client_id IN (SELECT public.get_user_client_ids()))));
CREATE POLICY yearly_key_results_insert ON public.yearly_key_results FOR INSERT
  WITH CHECK ((yearly_goal_id IN (SELECT yg.id FROM public.yearly_goals yg WHERE yg.client_id IN (SELECT public.get_user_client_ids()))));
CREATE POLICY yearly_key_results_update ON public.yearly_key_results FOR UPDATE
  USING ((yearly_goal_id IN (SELECT yg.id FROM public.yearly_goals yg WHERE yg.client_id IN (SELECT public.get_user_client_ids()))));
CREATE POLICY yearly_key_results_delete ON public.yearly_key_results FOR DELETE
  USING ((yearly_goal_id IN (SELECT yg.id FROM public.yearly_goals yg WHERE yg.client_id IN (SELECT public.get_user_client_ids()))));

-- quarterly_goals
CREATE POLICY quarterly_goals_select ON public.quarterly_goals FOR SELECT
  USING ((client_id IN (SELECT public.get_user_client_ids())));
CREATE POLICY quarterly_goals_insert ON public.quarterly_goals FOR INSERT
  WITH CHECK ((client_id IN (SELECT public.get_user_client_ids())));
CREATE POLICY quarterly_goals_update ON public.quarterly_goals FOR UPDATE
  USING ((client_id IN (SELECT public.get_user_client_ids())));
CREATE POLICY quarterly_goals_delete ON public.quarterly_goals FOR DELETE
  USING ((client_id IN (SELECT public.get_user_client_ids())));

-- quarterly_key_results
CREATE POLICY quarterly_key_results_select ON public.quarterly_key_results FOR SELECT
  USING ((quarterly_goal_id IN (SELECT qg.id FROM public.quarterly_goals qg WHERE qg.client_id IN (SELECT public.get_user_client_ids()))));
CREATE POLICY quarterly_key_results_insert ON public.quarterly_key_results FOR INSERT
  WITH CHECK ((quarterly_goal_id IN (SELECT qg.id FROM public.quarterly_goals qg WHERE qg.client_id IN (SELECT public.get_user_client_ids()))));
CREATE POLICY quarterly_key_results_update ON public.quarterly_key_results FOR UPDATE
  USING ((quarterly_goal_id IN (SELECT qg.id FROM public.quarterly_goals qg WHERE qg.client_id IN (SELECT public.get_user_client_ids()))));
CREATE POLICY quarterly_key_results_delete ON public.quarterly_key_results FOR DELETE
  USING ((quarterly_goal_id IN (SELECT qg.id FROM public.quarterly_goals qg WHERE qg.client_id IN (SELECT public.get_user_client_ids()))));

-- weekly_values
CREATE POLICY weekly_values_select ON public.weekly_values FOR SELECT
  USING ((quarterly_key_result_id IN (SELECT qkr.id FROM public.quarterly_key_results qkr WHERE qkr.quarterly_goal_id IN (SELECT qg.id FROM public.quarterly_goals qg WHERE qg.client_id IN (SELECT public.get_user_client_ids())))));
CREATE POLICY weekly_values_insert ON public.weekly_values FOR INSERT
  WITH CHECK ((quarterly_key_result_id IN (SELECT qkr.id FROM public.quarterly_key_results qkr WHERE qkr.quarterly_goal_id IN (SELECT qg.id FROM public.quarterly_goals qg WHERE qg.client_id IN (SELECT public.get_user_client_ids())))));
CREATE POLICY weekly_values_update ON public.weekly_values FOR UPDATE
  USING ((quarterly_key_result_id IN (SELECT qkr.id FROM public.quarterly_key_results qkr WHERE qkr.quarterly_goal_id IN (SELECT qg.id FROM public.quarterly_goals qg WHERE qg.client_id IN (SELECT public.get_user_client_ids())))));
CREATE POLICY weekly_values_delete ON public.weekly_values FOR DELETE
  USING ((quarterly_key_result_id IN (SELECT qkr.id FROM public.quarterly_key_results qkr WHERE qkr.quarterly_goal_id IN (SELECT qg.id FROM public.quarterly_goals qg WHERE qg.client_id IN (SELECT public.get_user_client_ids())))));

-- metrics
CREATE POLICY metrics_select ON public.metrics FOR SELECT
  USING ((client_id IN (SELECT public.get_user_client_ids())));
CREATE POLICY metrics_insert ON public.metrics FOR INSERT
  WITH CHECK ((client_id IN (SELECT public.get_user_client_ids())));
CREATE POLICY metrics_update ON public.metrics FOR UPDATE
  USING ((client_id IN (SELECT public.get_user_client_ids())));
CREATE POLICY metrics_delete ON public.metrics FOR DELETE
  USING ((client_id IN (SELECT public.get_user_client_ids())));

-- metric_values
CREATE POLICY metric_values_select ON public.metric_values FOR SELECT
  USING ((metric_id IN (SELECT m.id FROM public.metrics m WHERE m.client_id IN (SELECT public.get_user_client_ids()))));
CREATE POLICY metric_values_insert ON public.metric_values FOR INSERT
  WITH CHECK ((metric_id IN (SELECT m.id FROM public.metrics m WHERE m.client_id IN (SELECT public.get_user_client_ids()))));
CREATE POLICY metric_values_update ON public.metric_values FOR UPDATE
  USING ((metric_id IN (SELECT m.id FROM public.metrics m WHERE m.client_id IN (SELECT public.get_user_client_ids()))));
CREATE POLICY metric_values_delete ON public.metric_values FOR DELETE
  USING ((metric_id IN (SELECT m.id FROM public.metrics m WHERE m.client_id IN (SELECT public.get_user_client_ids()))));

-- conversations
CREATE POLICY conversations_select_participant ON public.conversations FOR SELECT
  USING (
    (auth.uid() = coach_id)
    OR (auth.uid() = member_id)
    OR ((is_group = true) AND EXISTS (SELECT 1 FROM public.client_members cm WHERE cm.client_id = conversations.client_id AND cm.user_id = auth.uid()))
    OR public.is_super_admin()
  );
CREATE POLICY conversations_insert_coach ON public.conversations FOR INSERT
  WITH CHECK (
    ((auth.uid() = coach_id) AND (client_id IN (SELECT cm.client_id FROM public.client_members cm WHERE cm.user_id = auth.uid() AND cm.role = 'coach'::text)))
    OR public.is_super_admin()
  );

-- messages
CREATE POLICY messages_select_participant ON public.messages FOR SELECT
  USING (
    (conversation_id IN (SELECT c.id FROM public.conversations c WHERE (auth.uid() = c.coach_id) OR (auth.uid() = c.member_id) OR ((c.is_group = true) AND EXISTS (SELECT 1 FROM public.client_members cm WHERE cm.client_id = c.client_id AND cm.user_id = auth.uid()))))
    OR public.is_super_admin()
  );
CREATE POLICY messages_insert_participant ON public.messages FOR INSERT
  WITH CHECK (
    ((auth.uid() = sender_id) AND (conversation_id IN (SELECT c.id FROM public.conversations c WHERE (auth.uid() = c.coach_id) OR (auth.uid() = c.member_id) OR ((c.is_group = true) AND EXISTS (SELECT 1 FROM public.client_members cm WHERE cm.client_id = c.client_id AND cm.user_id = auth.uid())))))
    OR public.is_super_admin()
  );

-- message_key_results
CREATE POLICY message_key_results_select ON public.message_key_results FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.messages m JOIN public.conversations c ON c.id = m.conversation_id WHERE m.id = message_key_results.message_id AND (c.coach_id = auth.uid() OR c.member_id = auth.uid()))
    OR public.is_super_admin()
  );
CREATE POLICY message_key_results_insert ON public.message_key_results FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.messages m JOIN public.conversations c ON c.id = m.conversation_id WHERE m.id = message_key_results.message_id AND m.sender_id = auth.uid() AND (c.coach_id = auth.uid() OR c.member_id = auth.uid()))
    OR public.is_super_admin()
  );

-- message_standard_goals
CREATE POLICY message_standard_goals_select ON public.message_standard_goals FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.messages m JOIN public.conversations c ON c.id = m.conversation_id
      WHERE m.id = message_standard_goals.message_id AND (c.coach_id = auth.uid() OR c.member_id = auth.uid()))
    OR public.is_super_admin()
  );
CREATE POLICY message_standard_goals_insert ON public.message_standard_goals FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.messages m JOIN public.conversations c ON c.id = m.conversation_id
      WHERE m.id = message_standard_goals.message_id AND m.sender_id = auth.uid() AND (c.coach_id = auth.uid() OR c.member_id = auth.uid()))
    OR public.is_super_admin()
  );

-- google_calendar_connections
CREATE POLICY google_calendar_connections_select ON public.google_calendar_connections FOR SELECT
  USING (
    (user_id = auth.uid())
    OR (client_id IN (SELECT cm.client_id FROM public.client_members cm WHERE cm.user_id = auth.uid() AND cm.role = 'coach'::text))
    OR public.is_super_admin()
  );
CREATE POLICY google_calendar_connections_insert ON public.google_calendar_connections FOR INSERT
  WITH CHECK (
    (client_id IN (SELECT cm.client_id FROM public.client_members cm WHERE cm.user_id = auth.uid() AND cm.role = 'coach'::text))
    OR public.is_super_admin()
  );
CREATE POLICY google_calendar_connections_update ON public.google_calendar_connections FOR UPDATE
  USING ((user_id = auth.uid()) OR public.is_super_admin());
CREATE POLICY google_calendar_connections_delete ON public.google_calendar_connections FOR DELETE
  USING ((user_id = auth.uid()) OR public.is_super_admin());

-- meetings
CREATE POLICY meetings_select ON public.meetings FOR SELECT
  USING (
    (client_id IN (SELECT cm.client_id FROM public.client_members cm WHERE cm.user_id = auth.uid()))
    OR public.is_super_admin()
  );
CREATE POLICY meetings_insert ON public.meetings FOR INSERT
  WITH CHECK (
    (client_id IN (SELECT cm.client_id FROM public.client_members cm WHERE cm.user_id = auth.uid() AND cm.role = 'coach'::text))
    OR public.is_super_admin()
  );
CREATE POLICY meetings_update ON public.meetings FOR UPDATE
  USING (
    (client_id IN (SELECT cm.client_id FROM public.client_members cm WHERE cm.user_id = auth.uid() AND cm.role = 'coach'::text))
    OR public.is_super_admin()
  );
CREATE POLICY meetings_delete ON public.meetings FOR DELETE
  USING (
    (client_id IN (SELECT cm.client_id FROM public.client_members cm WHERE cm.user_id = auth.uid() AND cm.role = 'coach'::text))
    OR public.is_super_admin()
  );

-- meeting_documents
CREATE POLICY meeting_documents_select ON public.meeting_documents FOR SELECT
  USING (
    (meeting_id IN (SELECT m.id FROM public.meetings m WHERE m.client_id IN (SELECT cm.client_id FROM public.client_members cm WHERE cm.user_id = auth.uid())))
    OR public.is_super_admin()
  );
CREATE POLICY meeting_documents_insert ON public.meeting_documents FOR INSERT
  WITH CHECK (
    (meeting_id IN (SELECT m.id FROM public.meetings m WHERE m.client_id IN (SELECT cm.client_id FROM public.client_members cm WHERE cm.user_id = auth.uid())))
    OR public.is_super_admin()
  );
CREATE POLICY meeting_documents_update ON public.meeting_documents FOR UPDATE
  USING (
    (meeting_id IN (SELECT m.id FROM public.meetings m WHERE m.client_id IN (SELECT cm.client_id FROM public.client_members cm WHERE cm.user_id = auth.uid())))
    OR public.is_super_admin()
  );
CREATE POLICY meeting_documents_delete ON public.meeting_documents FOR DELETE
  USING (
    (meeting_id IN (SELECT m.id FROM public.meetings m WHERE m.client_id IN (SELECT cm.client_id FROM public.client_members cm WHERE cm.user_id = auth.uid())))
    OR public.is_super_admin()
  );

-- automations
CREATE POLICY automations_select_coach ON public.automations FOR SELECT
  USING (
    (coach_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.client_members WHERE client_members.client_id = automations.client_id AND client_members.user_id = auth.uid() AND client_members.role = 'coach'::text)
    OR public.is_super_admin()
  );
CREATE POLICY automations_insert_coach ON public.automations FOR INSERT
  WITH CHECK (
    ((coach_id = auth.uid()) AND EXISTS (SELECT 1 FROM public.client_members WHERE client_members.client_id = automations.client_id AND client_members.user_id = auth.uid() AND client_members.role = 'coach'::text))
    OR public.is_super_admin()
  );
CREATE POLICY automations_update_coach ON public.automations FOR UPDATE
  USING (
    (coach_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.client_members WHERE client_members.client_id = automations.client_id AND client_members.user_id = auth.uid() AND client_members.role = 'coach'::text)
    OR public.is_super_admin()
  );
CREATE POLICY automations_delete_coach ON public.automations FOR DELETE
  USING (
    (coach_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.client_members WHERE client_members.client_id = automations.client_id AND client_members.user_id = auth.uid() AND client_members.role = 'coach'::text)
    OR public.is_super_admin()
  );

-- automation_recurring_config
CREATE POLICY recurring_config_select ON public.automation_recurring_config FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.automations WHERE automations.id = automation_recurring_config.automation_id AND ((automations.coach_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.client_members WHERE client_members.client_id = automations.client_id AND client_members.user_id = auth.uid() AND client_members.role = 'coach'::text)))
    OR public.is_super_admin()
  );
CREATE POLICY recurring_config_insert ON public.automation_recurring_config FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.automations WHERE automations.id = automation_recurring_config.automation_id AND automations.coach_id = auth.uid())
    OR public.is_super_admin()
  );
CREATE POLICY recurring_config_update ON public.automation_recurring_config FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.automations WHERE automations.id = automation_recurring_config.automation_id AND automations.coach_id = auth.uid())
    OR public.is_super_admin()
  );
CREATE POLICY recurring_config_delete ON public.automation_recurring_config FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.automations WHERE automations.id = automation_recurring_config.automation_id AND automations.coach_id = auth.uid())
    OR public.is_super_admin()
  );

-- automation_meeting_config
CREATE POLICY meeting_config_select ON public.automation_meeting_config FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.automations WHERE automations.id = automation_meeting_config.automation_id AND ((automations.coach_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.client_members WHERE client_members.client_id = automations.client_id AND client_members.user_id = auth.uid() AND client_members.role = 'coach'::text)))
    OR public.is_super_admin()
  );
CREATE POLICY meeting_config_insert ON public.automation_meeting_config FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.automations WHERE automations.id = automation_meeting_config.automation_id AND automations.coach_id = auth.uid())
    OR public.is_super_admin()
  );
CREATE POLICY meeting_config_update ON public.automation_meeting_config FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.automations WHERE automations.id = automation_meeting_config.automation_id AND automations.coach_id = auth.uid())
    OR public.is_super_admin()
  );
CREATE POLICY meeting_config_delete ON public.automation_meeting_config FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.automations WHERE automations.id = automation_meeting_config.automation_id AND automations.coach_id = auth.uid())
    OR public.is_super_admin()
  );

-- automation_key_results
CREATE POLICY automation_kr_select ON public.automation_key_results FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.automations WHERE automations.id = automation_key_results.automation_id AND ((automations.coach_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.client_members WHERE client_members.client_id = automations.client_id AND client_members.user_id = auth.uid() AND client_members.role = 'coach'::text)))
    OR public.is_super_admin()
  );
CREATE POLICY automation_kr_insert ON public.automation_key_results FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.automations WHERE automations.id = automation_key_results.automation_id AND automations.coach_id = auth.uid())
    OR public.is_super_admin()
  );
CREATE POLICY automation_kr_delete ON public.automation_key_results FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.automations WHERE automations.id = automation_key_results.automation_id AND automations.coach_id = auth.uid())
    OR public.is_super_admin()
  );

-- automation_members (was automation_founders)
CREATE POLICY automation_members_select ON public.automation_members FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.automations WHERE automations.id = automation_members.automation_id AND ((automations.coach_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.client_members WHERE client_members.client_id = automations.client_id AND client_members.user_id = auth.uid() AND client_members.role = 'coach'::text)))
    OR public.is_super_admin()
  );
CREATE POLICY automation_members_insert ON public.automation_members FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.automations WHERE automations.id = automation_members.automation_id AND automations.coach_id = auth.uid())
    OR public.is_super_admin()
  );
CREATE POLICY automation_members_delete ON public.automation_members FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.automations WHERE automations.id = automation_members.automation_id AND automations.coach_id = auth.uid())
    OR public.is_super_admin()
  );

-- automation_conversations
CREATE POLICY automation_conversations_select ON public.automation_conversations FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.automations a WHERE a.id = automation_conversations.automation_id AND a.coach_id = auth.uid())
    OR public.is_super_admin()
  );
CREATE POLICY automation_conversations_insert ON public.automation_conversations FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.automations a WHERE a.id = automation_conversations.automation_id AND a.coach_id = auth.uid())
    OR public.is_super_admin()
  );
CREATE POLICY automation_conversations_delete ON public.automation_conversations FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.automations a WHERE a.id = automation_conversations.automation_id AND a.coach_id = auth.uid())
    OR public.is_super_admin()
  );

-- automation_scheduled_config
CREATE POLICY scheduled_config_select ON public.automation_scheduled_config FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.automations a WHERE a.id = automation_scheduled_config.automation_id AND a.coach_id = auth.uid())
    OR public.is_super_admin()
  );
CREATE POLICY scheduled_config_insert ON public.automation_scheduled_config FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.automations a WHERE a.id = automation_scheduled_config.automation_id AND a.coach_id = auth.uid())
    OR public.is_super_admin()
  );
CREATE POLICY scheduled_config_update ON public.automation_scheduled_config FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.automations a WHERE a.id = automation_scheduled_config.automation_id AND a.coach_id = auth.uid())
    OR public.is_super_admin()
  );
CREATE POLICY scheduled_config_delete ON public.automation_scheduled_config FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.automations a WHERE a.id = automation_scheduled_config.automation_id AND a.coach_id = auth.uid())
    OR public.is_super_admin()
  );
CREATE POLICY scheduled_config_service ON public.automation_scheduled_config
  USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));

-- automation_execution_log
CREATE POLICY "Service role can manage execution logs" ON public.automation_execution_log USING (true) WITH CHECK (true);

-- goal_boards
CREATE POLICY goal_boards_select ON public.goal_boards FOR SELECT
  USING (client_id IN (SELECT public.get_user_client_ids()));
CREATE POLICY goal_boards_insert ON public.goal_boards FOR INSERT
  WITH CHECK (client_id IN (SELECT public.get_user_client_ids()));
CREATE POLICY goal_boards_update ON public.goal_boards FOR UPDATE
  USING (client_id IN (SELECT public.get_user_client_ids()));
CREATE POLICY goal_boards_delete ON public.goal_boards FOR DELETE
  USING (client_id IN (SELECT public.get_user_client_ids()));

-- standard_goals
CREATE POLICY standard_goals_select ON public.standard_goals FOR SELECT
  USING (board_id IN (SELECT id FROM public.goal_boards WHERE client_id IN (SELECT public.get_user_client_ids())));
CREATE POLICY standard_goals_insert ON public.standard_goals FOR INSERT
  WITH CHECK (board_id IN (SELECT id FROM public.goal_boards WHERE client_id IN (SELECT public.get_user_client_ids())));
CREATE POLICY standard_goals_update ON public.standard_goals FOR UPDATE
  USING (board_id IN (SELECT id FROM public.goal_boards WHERE client_id IN (SELECT public.get_user_client_ids())));
CREATE POLICY standard_goals_delete ON public.standard_goals FOR DELETE
  USING (board_id IN (SELECT id FROM public.goal_boards WHERE client_id IN (SELECT public.get_user_client_ids())));

-- standard_goal_values
CREATE POLICY standard_goal_values_select ON public.standard_goal_values FOR SELECT
  USING (standard_goal_id IN (SELECT id FROM public.standard_goals WHERE board_id IN (SELECT id FROM public.goal_boards WHERE client_id IN (SELECT public.get_user_client_ids()))));
CREATE POLICY standard_goal_values_insert ON public.standard_goal_values FOR INSERT
  WITH CHECK (standard_goal_id IN (SELECT id FROM public.standard_goals WHERE board_id IN (SELECT id FROM public.goal_boards WHERE client_id IN (SELECT public.get_user_client_ids()))));
CREATE POLICY standard_goal_values_update ON public.standard_goal_values FOR UPDATE
  USING (standard_goal_id IN (SELECT id FROM public.standard_goals WHERE board_id IN (SELECT id FROM public.goal_boards WHERE client_id IN (SELECT public.get_user_client_ids()))));
CREATE POLICY standard_goal_values_delete ON public.standard_goal_values FOR DELETE
  USING (standard_goal_id IN (SELECT id FROM public.standard_goals WHERE board_id IN (SELECT id FROM public.goal_boards WHERE client_id IN (SELECT public.get_user_client_ids()))));

-- =============================================================================
-- Step 7: Drop old indexes and create new ones
-- =============================================================================

-- Drop old indexes (some may have been auto-renamed by table rename, use IF EXISTS)
DROP INDEX IF EXISTS idx_companies_coach_id;
DROP INDEX IF EXISTS idx_company_members_company_id;
DROP INDEX IF EXISTS idx_company_members_user_id;
DROP INDEX IF EXISTS idx_company_members_emails;
DROP INDEX IF EXISTS idx_invitations_company_id;
DROP INDEX IF EXISTS idx_yearly_goals_company_id;
DROP INDEX IF EXISTS idx_quarterly_goals_company_id;
DROP INDEX IF EXISTS idx_metrics_company_id;
DROP INDEX IF EXISTS idx_google_calendar_connections_company;
DROP INDEX IF EXISTS idx_meetings_company;
DROP INDEX IF EXISTS idx_meetings_start_time;
DROP INDEX IF EXISTS idx_automations_company_id;
DROP INDEX IF EXISTS idx_automation_founders_automation_id;
DROP INDEX IF EXISTS idx_automation_founders_founder_member_id;
DROP INDEX IF EXISTS idx_goal_boards_company;

-- Create new indexes
CREATE INDEX IF NOT EXISTS idx_clients_coach_id ON public.clients USING btree (coach_id);
CREATE INDEX IF NOT EXISTS idx_client_members_client_id ON public.client_members USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_client_members_user_id ON public.client_members USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_client_members_emails ON public.client_members USING gin (emails);
CREATE INDEX IF NOT EXISTS idx_invitations_client_id ON public.invitations USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_yearly_goals_client_id ON public.yearly_goals USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_quarterly_goals_client_id ON public.quarterly_goals USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_metrics_client_id ON public.metrics USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_google_calendar_connections_client ON public.google_calendar_connections USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_meetings_client ON public.meetings USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_meetings_start_time ON public.meetings USING btree (client_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_automations_client_id ON public.automations USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_automation_members_automation_id ON public.automation_members USING btree (automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_members_member_id ON public.automation_members USING btree (member_id);
CREATE INDEX IF NOT EXISTS idx_goal_boards_client ON public.goal_boards USING btree (client_id);

-- Recreate unique indexes with new column names
-- conversations_company_group_unique
DROP INDEX IF EXISTS conversations_company_group_unique;
CREATE UNIQUE INDEX conversations_client_group_unique ON public.conversations USING btree (client_id) WHERE (is_group = true);

-- =============================================================================
-- Step 8: Update unique constraints that reference old column names
-- Foreign keys auto-follow column renames, but named constraints may need updating
-- =============================================================================

-- conversations unique constraint
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_company_id_coach_id_founder_id_key;
ALTER TABLE public.conversations ADD CONSTRAINT conversations_client_id_coach_id_member_id_key UNIQUE (client_id, coach_id, member_id);

-- google_calendar_connections unique constraint
ALTER TABLE public.google_calendar_connections DROP CONSTRAINT IF EXISTS google_calendar_connections_company_id_user_id_key;
ALTER TABLE public.google_calendar_connections ADD CONSTRAINT google_calendar_connections_client_id_user_id_key UNIQUE (client_id, user_id);

-- meetings unique constraint
ALTER TABLE public.meetings DROP CONSTRAINT IF EXISTS meetings_company_id_google_event_id_key;
ALTER TABLE public.meetings ADD CONSTRAINT meetings_client_id_google_event_id_key UNIQUE (client_id, google_event_id);

-- automation_members unique constraint (was automation_founders)
ALTER TABLE public.automation_members DROP CONSTRAINT IF EXISTS automation_founders_automation_id_founder_member_id_key;
ALTER TABLE public.automation_members ADD CONSTRAINT automation_members_automation_id_member_id_key UNIQUE (automation_id, member_id);

-- =============================================================================
-- Step 9: Update foreign key constraint names (cosmetic but helpful)
-- Foreign keys auto-follow renames, but let's update the names
-- =============================================================================

-- standard_goals owner FK still references old table name in constraint
ALTER TABLE public.standard_goals DROP CONSTRAINT IF EXISTS standard_goals_owner_fkey;
ALTER TABLE public.standard_goals ADD CONSTRAINT standard_goals_owner_fkey
  FOREIGN KEY (owner_id) REFERENCES public.client_members(id) ON DELETE SET NULL;

-- quarterly_key_results owner FK
ALTER TABLE public.quarterly_key_results DROP CONSTRAINT IF EXISTS quarterly_key_results_owner_id_fkey;
ALTER TABLE public.quarterly_key_results ADD CONSTRAINT quarterly_key_results_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES public.client_members(id) ON DELETE SET NULL;

-- invitations member FK
ALTER TABLE public.invitations DROP CONSTRAINT IF EXISTS invitations_member_id_fkey;
ALTER TABLE public.invitations ADD CONSTRAINT invitations_member_id_fkey
  FOREIGN KEY (member_id) REFERENCES public.client_members(id) ON DELETE SET NULL;

-- automation_members FK
ALTER TABLE public.automation_members DROP CONSTRAINT IF EXISTS automation_founders_automation_id_fkey;
ALTER TABLE public.automation_members DROP CONSTRAINT IF EXISTS automation_founders_founder_member_id_fkey;
ALTER TABLE public.automation_members ADD CONSTRAINT automation_members_automation_id_fkey
  FOREIGN KEY (automation_id) REFERENCES public.automations(id) ON DELETE CASCADE;
ALTER TABLE public.automation_members ADD CONSTRAINT automation_members_member_id_fkey
  FOREIGN KEY (member_id) REFERENCES public.client_members(id) ON DELETE CASCADE;

-- =============================================================================
-- Step 10: Update realtime publication
-- =============================================================================

-- Remove old table names (they may have auto-renamed, but let's be safe)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.companies;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.company_members;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END$$;

-- Ensure new names are in the publication (idempotent — will error if already there, so use DO block)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.client_members;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END$$;

-- =============================================================================
-- Step 11: Rename primary key constraints (cosmetic)
-- =============================================================================

ALTER TABLE public.clients RENAME CONSTRAINT companies_pkey TO clients_pkey;
ALTER TABLE public.client_members RENAME CONSTRAINT company_members_pkey TO client_members_pkey;
ALTER TABLE public.automation_members RENAME CONSTRAINT automation_founders_pkey TO automation_members_pkey;

COMMIT;
