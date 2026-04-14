-- =============================================================================
-- Flexible Goal-Setting System Migration
-- Adds goal boards, standard goals, and goal structure settings
-- =============================================================================

-- Step 1: Add goal_structures column to companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS goal_structures text[] DEFAULT ARRAY['standard']::text[];

-- Auto-enable OKR for companies that already have yearly/quarterly goals
UPDATE public.companies SET goal_structures = ARRAY['standard', 'okr']
WHERE id IN (
  SELECT DISTINCT company_id FROM public.yearly_goals
  UNION
  SELECT DISTINCT company_id FROM public.quarterly_goals
);

-- Step 2: Create goal_boards table
CREATE TABLE IF NOT EXISTS public.goal_boards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    title text NOT NULL,
    board_type text NOT NULL DEFAULT 'standard',
    archived boolean DEFAULT false,
    position integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT goal_boards_pkey PRIMARY KEY (id),
    CONSTRAINT goal_boards_company_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
    CONSTRAINT goal_boards_board_type_check CHECK (board_type IN ('standard', 'priorities'))
);
CREATE INDEX IF NOT EXISTS idx_goal_boards_company ON public.goal_boards(company_id);

-- Step 3: Create standard_goals table
CREATE TABLE IF NOT EXISTS public.standard_goals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    board_id uuid NOT NULL,
    goal_type text NOT NULL,
    title text NOT NULL,
    description text,
    target_value numeric NOT NULL DEFAULT 0,
    value_type text NOT NULL DEFAULT 'number',
    target_date date,
    check_in_frequency text,
    period text,
    owner_id uuid,
    is_priority boolean DEFAULT false,
    confidence text DEFAULT 'not_started',
    position integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT standard_goals_pkey PRIMARY KEY (id),
    CONSTRAINT standard_goals_board_fkey FOREIGN KEY (board_id) REFERENCES public.goal_boards(id) ON DELETE CASCADE,
    CONSTRAINT standard_goals_owner_fkey FOREIGN KEY (owner_id) REFERENCES public.company_members(id) ON DELETE SET NULL,
    CONSTRAINT standard_goals_goal_type_check CHECK (goal_type IN ('milestone', 'periodic')),
    CONSTRAINT standard_goals_value_type_check CHECK (value_type IN ('number', 'percentage')),
    CONSTRAINT standard_goals_frequency_check CHECK (check_in_frequency IS NULL OR check_in_frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
    CONSTRAINT standard_goals_period_check CHECK (period IS NULL OR period IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'))
);
CREATE INDEX IF NOT EXISTS idx_standard_goals_board ON public.standard_goals(board_id);

-- Step 4: Create standard_goal_values table
CREATE TABLE IF NOT EXISTS public.standard_goal_values (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    standard_goal_id uuid NOT NULL,
    period_key text NOT NULL,
    value numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT standard_goal_values_pkey PRIMARY KEY (id),
    CONSTRAINT standard_goal_values_goal_fkey FOREIGN KEY (standard_goal_id) REFERENCES public.standard_goals(id) ON DELETE CASCADE,
    CONSTRAINT standard_goal_values_unique UNIQUE (standard_goal_id, period_key)
);
CREATE INDEX IF NOT EXISTS idx_standard_goal_values_goal ON public.standard_goal_values(standard_goal_id);

-- Step 5: Create message_standard_goals junction table
CREATE TABLE IF NOT EXISTS public.message_standard_goals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    standard_goal_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT message_standard_goals_pkey PRIMARY KEY (id),
    CONSTRAINT message_standard_goals_message_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE,
    CONSTRAINT message_standard_goals_goal_fkey FOREIGN KEY (standard_goal_id) REFERENCES public.standard_goals(id) ON DELETE CASCADE,
    CONSTRAINT message_standard_goals_unique UNIQUE (message_id, standard_goal_id)
);

-- =============================================================================
-- Enable RLS
-- =============================================================================
ALTER TABLE public.goal_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standard_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standard_goal_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_standard_goals ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS Policies: goal_boards
-- =============================================================================
CREATE POLICY goal_boards_select ON public.goal_boards FOR SELECT
  USING (company_id IN (SELECT public.get_user_company_ids()));
CREATE POLICY goal_boards_insert ON public.goal_boards FOR INSERT
  WITH CHECK (company_id IN (SELECT public.get_user_company_ids()));
CREATE POLICY goal_boards_update ON public.goal_boards FOR UPDATE
  USING (company_id IN (SELECT public.get_user_company_ids()));
CREATE POLICY goal_boards_delete ON public.goal_boards FOR DELETE
  USING (company_id IN (SELECT public.get_user_company_ids()));

-- =============================================================================
-- RLS Policies: standard_goals (chain through goal_boards)
-- =============================================================================
CREATE POLICY standard_goals_select ON public.standard_goals FOR SELECT
  USING (board_id IN (SELECT id FROM public.goal_boards WHERE company_id IN (SELECT public.get_user_company_ids())));
CREATE POLICY standard_goals_insert ON public.standard_goals FOR INSERT
  WITH CHECK (board_id IN (SELECT id FROM public.goal_boards WHERE company_id IN (SELECT public.get_user_company_ids())));
CREATE POLICY standard_goals_update ON public.standard_goals FOR UPDATE
  USING (board_id IN (SELECT id FROM public.goal_boards WHERE company_id IN (SELECT public.get_user_company_ids())));
CREATE POLICY standard_goals_delete ON public.standard_goals FOR DELETE
  USING (board_id IN (SELECT id FROM public.goal_boards WHERE company_id IN (SELECT public.get_user_company_ids())));

-- =============================================================================
-- RLS Policies: standard_goal_values (chain through standard_goals → goal_boards)
-- =============================================================================
CREATE POLICY standard_goal_values_select ON public.standard_goal_values FOR SELECT
  USING (standard_goal_id IN (SELECT id FROM public.standard_goals WHERE board_id IN (SELECT id FROM public.goal_boards WHERE company_id IN (SELECT public.get_user_company_ids()))));
CREATE POLICY standard_goal_values_insert ON public.standard_goal_values FOR INSERT
  WITH CHECK (standard_goal_id IN (SELECT id FROM public.standard_goals WHERE board_id IN (SELECT id FROM public.goal_boards WHERE company_id IN (SELECT public.get_user_company_ids()))));
CREATE POLICY standard_goal_values_update ON public.standard_goal_values FOR UPDATE
  USING (standard_goal_id IN (SELECT id FROM public.standard_goals WHERE board_id IN (SELECT id FROM public.goal_boards WHERE company_id IN (SELECT public.get_user_company_ids()))));
CREATE POLICY standard_goal_values_delete ON public.standard_goal_values FOR DELETE
  USING (standard_goal_id IN (SELECT id FROM public.standard_goals WHERE board_id IN (SELECT id FROM public.goal_boards WHERE company_id IN (SELECT public.get_user_company_ids()))));

-- =============================================================================
-- RLS Policies: message_standard_goals (same pattern as message_key_results)
-- =============================================================================
CREATE POLICY message_standard_goals_select ON public.message_standard_goals FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.messages m JOIN public.conversations c ON c.id = m.conversation_id
      WHERE m.id = message_standard_goals.message_id AND (c.coach_id = auth.uid() OR c.founder_id = auth.uid()))
    OR public.is_super_admin()
  );
CREATE POLICY message_standard_goals_insert ON public.message_standard_goals FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.messages m JOIN public.conversations c ON c.id = m.conversation_id
      WHERE m.id = message_standard_goals.message_id AND m.sender_id = auth.uid() AND (c.coach_id = auth.uid() OR c.founder_id = auth.uid()))
    OR public.is_super_admin()
  );

-- =============================================================================
-- Realtime
-- =============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.goal_boards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.standard_goals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.standard_goal_values;
