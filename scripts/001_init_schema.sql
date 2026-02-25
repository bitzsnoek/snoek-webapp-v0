-- Initial schema for GoalTracker app
-- Create auth schema tables (managed by Supabase)

-- Create profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create companies table
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create company_members table (connects users to companies)
CREATE TABLE IF NOT EXISTS public.company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'founder', -- 'founder', 'coach', 'admin'
  name TEXT NOT NULL, -- Founder/member name
  role_title TEXT, -- CEO, CTO, COO, etc
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, user_id)
);

-- Create yearly_goals table
CREATE TABLE IF NOT EXISTS public.yearly_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  objective TEXT NOT NULL,
  archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create yearly_key_results table
CREATE TABLE IF NOT EXISTS public.yearly_key_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  yearly_goal_id UUID NOT NULL REFERENCES public.yearly_goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  confidence TEXT DEFAULT 'not_started', -- 'not_started', 'on_track', 'at_risk', 'done', 'discontinued'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create quarterly_goals table
CREATE TABLE IF NOT EXISTS public.quarterly_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  quarter INTEGER NOT NULL,
  yearly_goal_id UUID REFERENCES public.yearly_goals(id) ON DELETE SET NULL,
  objective TEXT NOT NULL,
  archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create quarterly_key_results table
CREATE TABLE IF NOT EXISTS public.quarterly_key_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quarterly_goal_id UUID NOT NULL REFERENCES public.quarterly_goals(id) ON DELETE CASCADE,
  yearly_key_result_id UUID REFERENCES public.yearly_key_results(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL, -- 'input', 'output', 'project'
  target NUMERIC NOT NULL,
  owner_id UUID REFERENCES public.company_members(id) ON DELETE SET NULL,
  is_priority BOOLEAN DEFAULT FALSE,
  confidence TEXT DEFAULT 'not_started', -- 'not_started', 'on_track', 'at_risk', 'done', 'discontinued'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create weekly_values table
CREATE TABLE IF NOT EXISTS public.weekly_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quarterly_key_result_id UUID NOT NULL REFERENCES public.quarterly_key_results(id) ON DELETE CASCADE,
  week INTEGER NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(quarterly_key_result_id, week)
);

-- Create metrics table
CREATE TABLE IF NOT EXISTS public.metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create metric_values table
CREATE TABLE IF NOT EXISTS public.metric_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_id UUID NOT NULL REFERENCES public.metrics(id) ON DELETE CASCADE,
  month INTEGER NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(metric_id, month)
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yearly_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yearly_key_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quarterly_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quarterly_key_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metric_values ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for companies (allow access through company_members)
CREATE POLICY "companies_select_member" ON public.companies FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = companies.id AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "companies_insert_coach" ON public.companies FOR INSERT WITH CHECK (auth.uid() = coach_id);
CREATE POLICY "companies_update_coach" ON public.companies FOR UPDATE USING (auth.uid() = coach_id);
CREATE POLICY "companies_delete_coach" ON public.companies FOR DELETE USING (auth.uid() = coach_id);

-- RLS Policies for company_members
CREATE POLICY "company_members_select" ON public.company_members FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = company_members.company_id AND cm.user_id = auth.uid()
  )
);

-- RLS Policies for yearly_goals
CREATE POLICY "yearly_goals_select" ON public.yearly_goals FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = yearly_goals.company_id AND cm.user_id = auth.uid()
  )
);

-- RLS Policies for quarterly_goals
CREATE POLICY "quarterly_goals_select" ON public.quarterly_goals FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = quarterly_goals.company_id AND cm.user_id = auth.uid()
  )
);

-- RLS Policies for quarterly_key_results
CREATE POLICY "quarterly_key_results_select" ON public.quarterly_key_results FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.quarterly_goals qg
    JOIN public.company_members cm ON cm.company_id = qg.company_id
    WHERE qg.id = quarterly_key_results.quarterly_goal_id AND cm.user_id = auth.uid()
  )
);

-- RLS Policies for metrics
CREATE POLICY "metrics_select" ON public.metrics FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = metrics.company_id AND cm.user_id = auth.uid()
  )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_companies_coach_id ON public.companies(coach_id);
CREATE INDEX IF NOT EXISTS idx_company_members_company_id ON public.company_members(company_id);
CREATE INDEX IF NOT EXISTS idx_company_members_user_id ON public.company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_yearly_goals_company_id ON public.yearly_goals(company_id);
CREATE INDEX IF NOT EXISTS idx_quarterly_goals_company_id ON public.quarterly_goals(company_id);
CREATE INDEX IF NOT EXISTS idx_quarterly_key_results_goal_id ON public.quarterly_key_results(quarterly_goal_id);
CREATE INDEX IF NOT EXISTS idx_weekly_values_kr_id ON public.weekly_values(quarterly_key_result_id);
CREATE INDEX IF NOT EXISTS idx_metrics_company_id ON public.metrics(company_id);
CREATE INDEX IF NOT EXISTS idx_metric_values_metric_id ON public.metric_values(metric_id);
