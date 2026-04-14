-- =============================================================================
-- Super Admin Role Migration
-- Adds is_super_admin flag to profiles and updates RLS policies
-- =============================================================================

-- Step 1: Add column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_super_admin boolean DEFAULT false;

-- Step 2: Create is_super_admin() helper function
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- Step 3: Update get_user_company_ids() to return all companies for super admins
CREATE OR REPLACE FUNCTION public.get_user_company_ids()
RETURNS SETOF uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true THEN
    RETURN QUERY SELECT id FROM public.companies;
  ELSE
    RETURN QUERY SELECT company_id FROM public.company_members WHERE user_id = auth.uid();
  END IF;
END;
$$;

-- Step 4: Update get_company_members_with_email() to allow super admin access
CREATE OR REPLACE FUNCTION public.get_company_members_with_email(p_company_id uuid)
RETURNS TABLE(
  id uuid,
  company_id uuid,
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
    SELECT 1 FROM company_members cm
    WHERE cm.company_id = p_company_id AND cm.user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = p_company_id AND c.coach_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: You are not a member of this company';
  END IF;

  RETURN QUERY
  SELECT
    cm.id, cm.company_id, cm.user_id, cm.created_at,
    cm.role, cm.name, cm.avatar_url, cm.emails, cm.role_title,
    au.email as user_email
  FROM company_members cm
  LEFT JOIN auth.users au ON cm.user_id = au.id
  WHERE cm.company_id = p_company_id;
END;
$$;

-- =============================================================================
-- Step 5: Update RLS policies that don't use get_user_company_ids()
-- =============================================================================

-- companies: INSERT/UPDATE/DELETE use coach_id = auth.uid()
DROP POLICY IF EXISTS companies_insert_coach ON public.companies;
CREATE POLICY companies_insert_coach ON public.companies FOR INSERT
  WITH CHECK ((auth.uid() = coach_id) OR public.is_super_admin());

DROP POLICY IF EXISTS companies_update_coach ON public.companies;
CREATE POLICY companies_update_coach ON public.companies FOR UPDATE
  USING ((auth.uid() = coach_id) OR public.is_super_admin());

DROP POLICY IF EXISTS companies_delete_coach ON public.companies;
CREATE POLICY companies_delete_coach ON public.companies FOR DELETE
  USING ((auth.uid() = coach_id) OR public.is_super_admin());

-- company_members: INSERT uses coach ownership check
DROP POLICY IF EXISTS company_members_insert ON public.company_members;
CREATE POLICY company_members_insert ON public.company_members FOR INSERT TO authenticated
  WITH CHECK (
    (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_members.company_id AND c.coach_id = auth.uid()))
    OR (user_id = auth.uid())
    OR public.is_super_admin()
  );

-- invitations: coach-based policies
DROP POLICY IF EXISTS "Coaches can view their company invitations" ON public.invitations;
CREATE POLICY "Coaches can view their company invitations" ON public.invitations FOR SELECT
  USING (
    (company_id IN (SELECT companies.id FROM public.companies WHERE companies.coach_id = auth.uid()))
    OR (invited_by = auth.uid())
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "Coaches can create invitations for their companies" ON public.invitations;
CREATE POLICY "Coaches can create invitations for their companies" ON public.invitations FOR INSERT
  WITH CHECK (
    ((invited_by = auth.uid()) AND (company_id IN (SELECT companies.id FROM public.companies WHERE companies.coach_id = auth.uid())))
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "Coaches can update their company invitations" ON public.invitations;
CREATE POLICY "Coaches can update their company invitations" ON public.invitations FOR UPDATE
  USING (
    ((invited_by = auth.uid()) AND (company_id IN (SELECT companies.id FROM public.companies WHERE companies.coach_id = auth.uid())))
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "Coaches can delete their company invitations" ON public.invitations;
CREATE POLICY "Coaches can delete their company invitations" ON public.invitations FOR DELETE
  USING (
    ((invited_by = auth.uid()) AND (company_id IN (SELECT companies.id FROM public.companies WHERE companies.coach_id = auth.uid())))
    OR public.is_super_admin()
  );

-- conversations
DROP POLICY IF EXISTS conversations_select_participant ON public.conversations;
CREATE POLICY conversations_select_participant ON public.conversations FOR SELECT
  USING (
    (auth.uid() = coach_id)
    OR (auth.uid() = founder_id)
    OR ((is_group = true) AND EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = conversations.company_id AND cm.user_id = auth.uid()))
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS conversations_insert_coach ON public.conversations;
CREATE POLICY conversations_insert_coach ON public.conversations FOR INSERT
  WITH CHECK (
    ((auth.uid() = coach_id) AND (company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid() AND cm.role = 'coach'::text)))
    OR public.is_super_admin()
  );

-- messages
DROP POLICY IF EXISTS messages_select_participant ON public.messages;
CREATE POLICY messages_select_participant ON public.messages FOR SELECT
  USING (
    (conversation_id IN (SELECT c.id FROM public.conversations c WHERE (auth.uid() = c.coach_id) OR (auth.uid() = c.founder_id) OR ((c.is_group = true) AND EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = c.company_id AND cm.user_id = auth.uid()))))
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS messages_insert_participant ON public.messages;
CREATE POLICY messages_insert_participant ON public.messages FOR INSERT
  WITH CHECK (
    ((auth.uid() = sender_id) AND (conversation_id IN (SELECT c.id FROM public.conversations c WHERE (auth.uid() = c.coach_id) OR (auth.uid() = c.founder_id) OR ((c.is_group = true) AND EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = c.company_id AND cm.user_id = auth.uid())))))
    OR public.is_super_admin()
  );

-- message_key_results
DROP POLICY IF EXISTS message_key_results_select ON public.message_key_results;
CREATE POLICY message_key_results_select ON public.message_key_results FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.messages m JOIN public.conversations c ON c.id = m.conversation_id WHERE m.id = message_key_results.message_id AND (c.coach_id = auth.uid() OR c.founder_id = auth.uid()))
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS message_key_results_insert ON public.message_key_results;
CREATE POLICY message_key_results_insert ON public.message_key_results FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.messages m JOIN public.conversations c ON c.id = m.conversation_id WHERE m.id = message_key_results.message_id AND m.sender_id = auth.uid() AND (c.coach_id = auth.uid() OR c.founder_id = auth.uid()))
    OR public.is_super_admin()
  );

-- google_calendar_connections
DROP POLICY IF EXISTS google_calendar_connections_select ON public.google_calendar_connections;
CREATE POLICY google_calendar_connections_select ON public.google_calendar_connections FOR SELECT
  USING (
    (user_id = auth.uid())
    OR (company_id IN (SELECT company_members.company_id FROM public.company_members WHERE company_members.user_id = auth.uid() AND company_members.role = 'coach'::text))
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS google_calendar_connections_insert ON public.google_calendar_connections;
CREATE POLICY google_calendar_connections_insert ON public.google_calendar_connections FOR INSERT
  WITH CHECK (
    (company_id IN (SELECT company_members.company_id FROM public.company_members WHERE company_members.user_id = auth.uid() AND company_members.role = 'coach'::text))
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS google_calendar_connections_update ON public.google_calendar_connections;
CREATE POLICY google_calendar_connections_update ON public.google_calendar_connections FOR UPDATE
  USING ((user_id = auth.uid()) OR public.is_super_admin());

DROP POLICY IF EXISTS google_calendar_connections_delete ON public.google_calendar_connections;
CREATE POLICY google_calendar_connections_delete ON public.google_calendar_connections FOR DELETE
  USING ((user_id = auth.uid()) OR public.is_super_admin());

-- meetings
DROP POLICY IF EXISTS meetings_select ON public.meetings;
CREATE POLICY meetings_select ON public.meetings FOR SELECT
  USING (
    (company_id IN (SELECT company_members.company_id FROM public.company_members WHERE company_members.user_id = auth.uid()))
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS meetings_insert ON public.meetings;
CREATE POLICY meetings_insert ON public.meetings FOR INSERT
  WITH CHECK (
    (company_id IN (SELECT company_members.company_id FROM public.company_members WHERE company_members.user_id = auth.uid() AND company_members.role = 'coach'::text))
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS meetings_update ON public.meetings;
CREATE POLICY meetings_update ON public.meetings FOR UPDATE
  USING (
    (company_id IN (SELECT company_members.company_id FROM public.company_members WHERE company_members.user_id = auth.uid() AND company_members.role = 'coach'::text))
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS meetings_delete ON public.meetings;
CREATE POLICY meetings_delete ON public.meetings FOR DELETE
  USING (
    (company_id IN (SELECT company_members.company_id FROM public.company_members WHERE company_members.user_id = auth.uid() AND company_members.role = 'coach'::text))
    OR public.is_super_admin()
  );

-- meeting_documents
DROP POLICY IF EXISTS meeting_documents_select_company ON public.meeting_documents;
CREATE POLICY meeting_documents_select_company ON public.meeting_documents FOR SELECT
  USING (
    (meeting_id IN (SELECT m.id FROM public.meetings m WHERE m.company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())))
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS meeting_documents_insert_company ON public.meeting_documents;
CREATE POLICY meeting_documents_insert_company ON public.meeting_documents FOR INSERT
  WITH CHECK (
    (meeting_id IN (SELECT m.id FROM public.meetings m WHERE m.company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())))
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS meeting_documents_update_company ON public.meeting_documents;
CREATE POLICY meeting_documents_update_company ON public.meeting_documents FOR UPDATE
  USING (
    (meeting_id IN (SELECT m.id FROM public.meetings m WHERE m.company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())))
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS meeting_documents_delete_company ON public.meeting_documents;
CREATE POLICY meeting_documents_delete_company ON public.meeting_documents FOR DELETE
  USING (
    (meeting_id IN (SELECT m.id FROM public.meetings m WHERE m.company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())))
    OR public.is_super_admin()
  );

-- automations
DROP POLICY IF EXISTS automations_select_coach ON public.automations;
CREATE POLICY automations_select_coach ON public.automations FOR SELECT
  USING (
    (coach_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = automations.company_id AND company_members.user_id = auth.uid() AND company_members.role = 'coach'::text)
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS automations_insert_coach ON public.automations;
CREATE POLICY automations_insert_coach ON public.automations FOR INSERT
  WITH CHECK (
    ((coach_id = auth.uid()) AND EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = automations.company_id AND company_members.user_id = auth.uid() AND company_members.role = 'coach'::text))
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS automations_update_coach ON public.automations;
CREATE POLICY automations_update_coach ON public.automations FOR UPDATE
  USING (
    (coach_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = automations.company_id AND company_members.user_id = auth.uid() AND company_members.role = 'coach'::text)
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS automations_delete_coach ON public.automations;
CREATE POLICY automations_delete_coach ON public.automations FOR DELETE
  USING (
    (coach_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = automations.company_id AND company_members.user_id = auth.uid() AND company_members.role = 'coach'::text)
    OR public.is_super_admin()
  );

-- automation_recurring_config
DROP POLICY IF EXISTS recurring_config_select ON public.automation_recurring_config;
CREATE POLICY recurring_config_select ON public.automation_recurring_config FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.automations WHERE automations.id = automation_recurring_config.automation_id AND ((automations.coach_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = automations.company_id AND company_members.user_id = auth.uid() AND company_members.role = 'coach'::text)))
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS recurring_config_insert ON public.automation_recurring_config;
CREATE POLICY recurring_config_insert ON public.automation_recurring_config FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.automations WHERE automations.id = automation_recurring_config.automation_id AND automations.coach_id = auth.uid())
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS recurring_config_update ON public.automation_recurring_config;
CREATE POLICY recurring_config_update ON public.automation_recurring_config FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.automations WHERE automations.id = automation_recurring_config.automation_id AND automations.coach_id = auth.uid())
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS recurring_config_delete ON public.automation_recurring_config;
CREATE POLICY recurring_config_delete ON public.automation_recurring_config FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.automations WHERE automations.id = automation_recurring_config.automation_id AND automations.coach_id = auth.uid())
    OR public.is_super_admin()
  );

-- automation_meeting_config
DROP POLICY IF EXISTS meeting_config_select ON public.automation_meeting_config;
CREATE POLICY meeting_config_select ON public.automation_meeting_config FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.automations WHERE automations.id = automation_meeting_config.automation_id AND ((automations.coach_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = automations.company_id AND company_members.user_id = auth.uid() AND company_members.role = 'coach'::text)))
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS meeting_config_insert ON public.automation_meeting_config;
CREATE POLICY meeting_config_insert ON public.automation_meeting_config FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.automations WHERE automations.id = automation_meeting_config.automation_id AND automations.coach_id = auth.uid())
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS meeting_config_update ON public.automation_meeting_config;
CREATE POLICY meeting_config_update ON public.automation_meeting_config FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.automations WHERE automations.id = automation_meeting_config.automation_id AND automations.coach_id = auth.uid())
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS meeting_config_delete ON public.automation_meeting_config;
CREATE POLICY meeting_config_delete ON public.automation_meeting_config FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.automations WHERE automations.id = automation_meeting_config.automation_id AND automations.coach_id = auth.uid())
    OR public.is_super_admin()
  );

-- automation_key_results
DROP POLICY IF EXISTS automation_kr_select ON public.automation_key_results;
CREATE POLICY automation_kr_select ON public.automation_key_results FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.automations WHERE automations.id = automation_key_results.automation_id AND ((automations.coach_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = automations.company_id AND company_members.user_id = auth.uid() AND company_members.role = 'coach'::text)))
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS automation_kr_insert ON public.automation_key_results;
CREATE POLICY automation_kr_insert ON public.automation_key_results FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.automations WHERE automations.id = automation_key_results.automation_id AND automations.coach_id = auth.uid())
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS automation_kr_delete ON public.automation_key_results;
CREATE POLICY automation_kr_delete ON public.automation_key_results FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.automations WHERE automations.id = automation_key_results.automation_id AND automations.coach_id = auth.uid())
    OR public.is_super_admin()
  );

-- automation_founders
DROP POLICY IF EXISTS automation_founders_select ON public.automation_founders;
CREATE POLICY automation_founders_select ON public.automation_founders FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.automations WHERE automations.id = automation_founders.automation_id AND ((automations.coach_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = automations.company_id AND company_members.user_id = auth.uid() AND company_members.role = 'coach'::text)))
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS automation_founders_insert ON public.automation_founders;
CREATE POLICY automation_founders_insert ON public.automation_founders FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.automations WHERE automations.id = automation_founders.automation_id AND automations.coach_id = auth.uid())
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS automation_founders_delete ON public.automation_founders;
CREATE POLICY automation_founders_delete ON public.automation_founders FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.automations WHERE automations.id = automation_founders.automation_id AND automations.coach_id = auth.uid())
    OR public.is_super_admin()
  );

-- automation_conversations
DROP POLICY IF EXISTS automation_conversations_select ON public.automation_conversations;
CREATE POLICY automation_conversations_select ON public.automation_conversations FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.automations a WHERE a.id = automation_conversations.automation_id AND a.coach_id = auth.uid())
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS automation_conversations_insert ON public.automation_conversations;
CREATE POLICY automation_conversations_insert ON public.automation_conversations FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.automations a WHERE a.id = automation_conversations.automation_id AND a.coach_id = auth.uid())
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS automation_conversations_delete ON public.automation_conversations;
CREATE POLICY automation_conversations_delete ON public.automation_conversations FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.automations a WHERE a.id = automation_conversations.automation_id AND a.coach_id = auth.uid())
    OR public.is_super_admin()
  );

-- automation_scheduled_config
DROP POLICY IF EXISTS scheduled_config_select ON public.automation_scheduled_config;
CREATE POLICY scheduled_config_select ON public.automation_scheduled_config FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.automations a WHERE a.id = automation_scheduled_config.automation_id AND a.coach_id = auth.uid())
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS scheduled_config_insert ON public.automation_scheduled_config;
CREATE POLICY scheduled_config_insert ON public.automation_scheduled_config FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.automations a WHERE a.id = automation_scheduled_config.automation_id AND a.coach_id = auth.uid())
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS scheduled_config_update ON public.automation_scheduled_config;
CREATE POLICY scheduled_config_update ON public.automation_scheduled_config FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.automations a WHERE a.id = automation_scheduled_config.automation_id AND a.coach_id = auth.uid())
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS scheduled_config_delete ON public.automation_scheduled_config;
CREATE POLICY scheduled_config_delete ON public.automation_scheduled_config FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.automations a WHERE a.id = automation_scheduled_config.automation_id AND a.coach_id = auth.uid())
    OR public.is_super_admin()
  );

-- =============================================================================
-- Step 6: Set super admin flag (replace with your actual user UUID)
-- =============================================================================
-- UPDATE public.profiles SET is_super_admin = true WHERE id = '<your-user-uuid>';
