-- Phase 2: Add goal groups table for organizing goals within boards

-- Create custom_goal_groups table
CREATE TABLE IF NOT EXISTS public.custom_goal_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES public.custom_goal_boards(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_collapsed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add group_id to custom_goals (nullable for ungrouped goals)
ALTER TABLE public.custom_goals 
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.custom_goal_groups(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_custom_goal_groups_board_id ON public.custom_goal_groups(board_id);
CREATE INDEX IF NOT EXISTS idx_custom_goals_group_id ON public.custom_goals(group_id);

-- Enable RLS
ALTER TABLE public.custom_goal_groups ENABLE ROW LEVEL SECURITY;

-- RLS Policies for custom_goal_groups
CREATE POLICY "custom_goal_groups_select" ON public.custom_goal_groups
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "custom_goal_groups_insert" ON public.custom_goal_groups
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "custom_goal_groups_update" ON public.custom_goal_groups
  FOR UPDATE USING (
    company_id IN (
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "custom_goal_groups_delete" ON public.custom_goal_groups
  FOR DELETE USING (
    company_id IN (
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_custom_goal_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS custom_goal_groups_updated_at ON public.custom_goal_groups;
CREATE TRIGGER custom_goal_groups_updated_at
  BEFORE UPDATE ON public.custom_goal_groups
  FOR EACH ROW EXECUTE FUNCTION update_custom_goal_groups_updated_at();
