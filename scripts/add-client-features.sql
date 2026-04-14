-- =============================================================================
-- Add client feature flags
-- Replaces goal_structures with a broader features array
-- =============================================================================

BEGIN;

-- Add features column
ALTER TABLE public.clients ADD COLUMN features text[] DEFAULT ARRAY[]::text[];

-- Migrate existing data: all current clients get metrics/meetings/automations
-- to preserve current behavior. OKR flag carried over from goal_structures.
UPDATE public.clients
SET features = ARRAY['okr', 'metrics', 'meetings', 'automations']
WHERE 'okr' = ANY(goal_structures);

UPDATE public.clients
SET features = ARRAY['metrics', 'meetings', 'automations']
WHERE NOT ('okr' = ANY(goal_structures));

-- Drop old column
ALTER TABLE public.clients DROP COLUMN goal_structures;

COMMIT;
