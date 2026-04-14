-- =============================================================================
-- Migration: Add Journals Feature
-- Date: 2026-04-12
-- Description: Adds journals, journal_entries, and message_journal_entries tables
--              for periodic reflection prompts and text journal entries.
-- =============================================================================

-- =========================================
-- 1. Create tables
-- =========================================

-- journals — the prompt/question set by a coach
CREATE TABLE public.journals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly')),
  assigned_member_id uuid REFERENCES public.client_members(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  archived boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.journals OWNER TO postgres;
GRANT ALL ON TABLE public.journals TO anon;
GRANT ALL ON TABLE public.journals TO authenticated;
GRANT ALL ON TABLE public.journals TO service_role;

-- journal_entries — member's written response
CREATE TABLE public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id uuid NOT NULL REFERENCES public.journals(id) ON DELETE CASCADE,
  period_key text NOT NULL,
  author_id uuid NOT NULL REFERENCES auth.users(id),
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (journal_id, period_key, author_id)
);

ALTER TABLE public.journal_entries OWNER TO postgres;
GRANT ALL ON TABLE public.journal_entries TO anon;
GRANT ALL ON TABLE public.journal_entries TO authenticated;
GRANT ALL ON TABLE public.journal_entries TO service_role;

-- message_journal_entries — chat attachment junction
CREATE TABLE public.message_journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  journal_entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, journal_entry_id)
);

ALTER TABLE public.message_journal_entries OWNER TO postgres;
GRANT ALL ON TABLE public.message_journal_entries TO anon;
GRANT ALL ON TABLE public.message_journal_entries TO authenticated;
GRANT ALL ON TABLE public.message_journal_entries TO service_role;

-- =========================================
-- 2. Indexes
-- =========================================

CREATE INDEX idx_journals_client_id ON public.journals USING btree (client_id);
CREATE INDEX idx_journal_entries_journal_id ON public.journal_entries USING btree (journal_id);
CREATE INDEX idx_journal_entries_author_id ON public.journal_entries USING btree (author_id);
CREATE INDEX idx_message_journal_entries_message_id ON public.message_journal_entries USING btree (message_id);

-- =========================================
-- 3. Enable RLS
-- =========================================

ALTER TABLE public.journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_journal_entries ENABLE ROW LEVEL SECURITY;

-- =========================================
-- 4. RLS Policies — journals
-- Same pattern as goal_boards: client_id IN get_user_client_ids()
-- =========================================

CREATE POLICY journals_select ON public.journals FOR SELECT
  USING (client_id IN (SELECT public.get_user_client_ids()));

CREATE POLICY journals_insert ON public.journals FOR INSERT
  WITH CHECK (client_id IN (SELECT public.get_user_client_ids()));

CREATE POLICY journals_update ON public.journals FOR UPDATE
  USING (client_id IN (SELECT public.get_user_client_ids()));

CREATE POLICY journals_delete ON public.journals FOR DELETE
  USING (client_id IN (SELECT public.get_user_client_ids()));

-- =========================================
-- 5. RLS Policies — journal_entries
-- Same pattern as standard_goal_values: join through parent for client access
-- =========================================

CREATE POLICY journal_entries_select ON public.journal_entries FOR SELECT
  USING (journal_id IN (
    SELECT id FROM public.journals WHERE client_id IN (SELECT public.get_user_client_ids())
  ));

CREATE POLICY journal_entries_insert ON public.journal_entries FOR INSERT
  WITH CHECK (journal_id IN (
    SELECT id FROM public.journals WHERE client_id IN (SELECT public.get_user_client_ids())
  ));

CREATE POLICY journal_entries_update ON public.journal_entries FOR UPDATE
  USING (journal_id IN (
    SELECT id FROM public.journals WHERE client_id IN (SELECT public.get_user_client_ids())
  ));

CREATE POLICY journal_entries_delete ON public.journal_entries FOR DELETE
  USING (journal_id IN (
    SELECT id FROM public.journals WHERE client_id IN (SELECT public.get_user_client_ids())
  ));

-- =========================================
-- 6. RLS Policies — message_journal_entries
-- Same pattern as message_key_results: join through messages → conversations
-- =========================================

CREATE POLICY message_journal_entries_select ON public.message_journal_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversations c ON c.id = m.conversation_id
      WHERE m.id = message_journal_entries.message_id
        AND (c.coach_id = auth.uid() OR c.member_id = auth.uid())
    )
    OR public.is_super_admin()
  );

CREATE POLICY message_journal_entries_insert ON public.message_journal_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversations c ON c.id = m.conversation_id
      WHERE m.id = message_journal_entries.message_id
        AND m.sender_id = auth.uid()
        AND (c.coach_id = auth.uid() OR c.member_id = auth.uid())
    )
    OR public.is_super_admin()
  );

-- =========================================
-- 7. Realtime
-- =========================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.journals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.journal_entries;

-- =========================================
-- 8. Updated_at trigger (reuse existing pattern)
-- =========================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_journals_updated_at
  BEFORE UPDATE ON public.journals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_journal_entries_updated_at
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
