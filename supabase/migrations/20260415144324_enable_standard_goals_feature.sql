-- =============================================================================
-- Add 'standard-goals' client feature flag
--
-- Gates the Standard Goal Boards UI (non-OKR, non-priorities boards).
-- Backfills the flag for every existing client that already has at least one
-- non-archived standard board so their UX doesn't regress, and also for every
-- client on an OKR plan (those plans may add standard boards later).
-- Run via Supabase Dashboard SQL Editor.
-- =============================================================================

BEGIN;

-- Backfill: any client that currently has a non-archived standard board
UPDATE public.clients c
SET features = array_append(c.features, 'standard-goals')
WHERE NOT ('standard-goals' = ANY(c.features))
  AND EXISTS (
    SELECT 1 FROM public.goal_boards b
    WHERE b.client_id = c.id
      AND b.board_type = 'standard'
      AND (b.archived IS NULL OR b.archived = false)
  );

-- Also enable by default for every client that already has OKR, so coaches
-- can keep spinning up standard boards on the same plan without an admin toggle.
UPDATE public.clients
SET features = array_append(features, 'standard-goals')
WHERE NOT ('standard-goals' = ANY(features))
  AND 'okr' = ANY(features);

COMMIT;
