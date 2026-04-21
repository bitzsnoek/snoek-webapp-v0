-- =============================================================================
-- Journal → chat message attachments (period-based, matches mobile app)
--
-- Replaces the entry-row-based `message_journal_entries` table. The new model
-- attaches a (journal_id, period_key) pair to a message, so the attachment
-- survives entry edits/deletions and can be created even before an entry
-- exists for that period.
--
-- Idempotent: safe to re-run if the table was already created on dev.
-- Run via Supabase Dashboard SQL Editor.
-- =============================================================================

BEGIN;

-- 1. Create the attachment table
CREATE TABLE IF NOT EXISTS public.message_journal_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  journal_id uuid NOT NULL REFERENCES public.journals(id) ON DELETE CASCADE,
  period_key text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, journal_id)
);

CREATE INDEX IF NOT EXISTS idx_message_journal_attachments_message_id
  ON public.message_journal_attachments(message_id);

ALTER TABLE public.message_journal_attachments ENABLE ROW LEVEL SECURITY;

-- 2. RLS policies (drop-then-create so the script is idempotent)
DROP POLICY IF EXISTS "message_journal_attachments_select" ON public.message_journal_attachments;
CREATE POLICY "message_journal_attachments_select" ON public.message_journal_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversations c ON c.id = m.conversation_id
      WHERE m.id = message_id
        AND (c.coach_id = auth.uid() OR c.member_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "message_journal_attachments_insert" ON public.message_journal_attachments;
CREATE POLICY "message_journal_attachments_insert" ON public.message_journal_attachments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversations c ON c.id = m.conversation_id
      WHERE m.id = message_id
        AND m.sender_id = auth.uid()
        AND (c.coach_id = auth.uid() OR c.member_id = auth.uid())
    )
  );

-- 3. Backfill attachments from the legacy `message_journal_entries` table.
--    Each legacy row points at a journal_entries row, which carries the
--    (journal_id, period_key) pair we need. The unique constraint on the
--    new table means ON CONFLICT DO NOTHING is enough for idempotency.
INSERT INTO public.message_journal_attachments (message_id, journal_id, period_key)
SELECT mje.message_id, je.journal_id, je.period_key
FROM public.message_journal_entries mje
JOIN public.journal_entries je ON je.id = mje.journal_entry_id
ON CONFLICT (message_id, journal_id) DO NOTHING;

-- 4. Leave the legacy `message_journal_entries` table in place for now so
--    rollback is easy. Once both apps have shipped and the backfill is
--    verified, drop it with:
--
--    DROP TABLE public.message_journal_entries;

COMMIT;
