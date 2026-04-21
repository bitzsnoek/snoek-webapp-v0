-- =============================================================================
-- Automation attachments: standard goals + journals
--
-- Brings automations in line with the chat composer (components/chat-section.tsx)
-- which supports attaching three kinds of items to a message:
--   1. OKR key results → message_key_results (already in automation_key_results)
--   2. Standard goals  → message_standard_goals (NEW: automation_standard_goals)
--   3. Journals        → message_journal_attachments
--      (NEW: automation_journal_attachments — stores journal_id only;
--       period_key is computed at fire time from journal.frequency so the
--       attachment always points at the "current" period when the automation
--       runs, matching how the chat UI attaches journals)
--
-- Policies mirror automation_key_results (drop-then-create, idempotent).
-- Run via Supabase Dashboard SQL Editor or `supabase db push`.
-- =============================================================================

BEGIN;

-- ------------------------------------------------------------------
-- 1. automation_standard_goals (parallels automation_key_results)
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.automation_standard_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  standard_goal_id uuid NOT NULL REFERENCES public.standard_goals(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (automation_id, standard_goal_id)
);

CREATE INDEX IF NOT EXISTS idx_automation_standard_goals_automation_id
  ON public.automation_standard_goals (automation_id);

ALTER TABLE public.automation_standard_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS automation_sg_select ON public.automation_standard_goals;
CREATE POLICY automation_sg_select ON public.automation_standard_goals
  FOR SELECT USING (
    (EXISTS (
      SELECT 1 FROM public.automations
      WHERE automations.id = automation_standard_goals.automation_id
        AND (
          automations.coach_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.client_members
            WHERE client_members.client_id = automations.client_id
              AND client_members.user_id = auth.uid()
              AND client_members.role = 'coach'
          )
        )
    )) OR public.is_super_admin()
  );

DROP POLICY IF EXISTS automation_sg_insert ON public.automation_standard_goals;
CREATE POLICY automation_sg_insert ON public.automation_standard_goals
  FOR INSERT WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.automations
      WHERE automations.id = automation_standard_goals.automation_id
        AND automations.coach_id = auth.uid()
    )) OR public.is_super_admin()
  );

DROP POLICY IF EXISTS automation_sg_delete ON public.automation_standard_goals;
CREATE POLICY automation_sg_delete ON public.automation_standard_goals
  FOR DELETE USING (
    (EXISTS (
      SELECT 1 FROM public.automations
      WHERE automations.id = automation_standard_goals.automation_id
        AND automations.coach_id = auth.uid()
    )) OR public.is_super_admin()
  );

GRANT ALL ON TABLE public.automation_standard_goals TO anon;
GRANT ALL ON TABLE public.automation_standard_goals TO authenticated;
GRANT ALL ON TABLE public.automation_standard_goals TO service_role;

-- ------------------------------------------------------------------
-- 2. automation_journal_attachments
--
-- Stores only journal_id. period_key is intentionally omitted because
-- the automation fires repeatedly (recurring) or at a future date
-- (scheduled), and we want the attachment to point at the journal
-- period that is current at fire time — not at configuration time.
-- The executor computes period_key from journals.frequency.
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.automation_journal_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  journal_id uuid NOT NULL REFERENCES public.journals(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (automation_id, journal_id)
);

CREATE INDEX IF NOT EXISTS idx_automation_journal_attachments_automation_id
  ON public.automation_journal_attachments (automation_id);

ALTER TABLE public.automation_journal_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS automation_ja_select ON public.automation_journal_attachments;
CREATE POLICY automation_ja_select ON public.automation_journal_attachments
  FOR SELECT USING (
    (EXISTS (
      SELECT 1 FROM public.automations
      WHERE automations.id = automation_journal_attachments.automation_id
        AND (
          automations.coach_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.client_members
            WHERE client_members.client_id = automations.client_id
              AND client_members.user_id = auth.uid()
              AND client_members.role = 'coach'
          )
        )
    )) OR public.is_super_admin()
  );

DROP POLICY IF EXISTS automation_ja_insert ON public.automation_journal_attachments;
CREATE POLICY automation_ja_insert ON public.automation_journal_attachments
  FOR INSERT WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.automations
      WHERE automations.id = automation_journal_attachments.automation_id
        AND automations.coach_id = auth.uid()
    )) OR public.is_super_admin()
  );

DROP POLICY IF EXISTS automation_ja_delete ON public.automation_journal_attachments;
CREATE POLICY automation_ja_delete ON public.automation_journal_attachments
  FOR DELETE USING (
    (EXISTS (
      SELECT 1 FROM public.automations
      WHERE automations.id = automation_journal_attachments.automation_id
        AND automations.coach_id = auth.uid()
    )) OR public.is_super_admin()
  );

GRANT ALL ON TABLE public.automation_journal_attachments TO anon;
GRANT ALL ON TABLE public.automation_journal_attachments TO authenticated;
GRANT ALL ON TABLE public.automation_journal_attachments TO service_role;

COMMIT;
