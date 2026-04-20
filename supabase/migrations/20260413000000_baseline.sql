-- =============================================================================
-- Snoek Webapp — Consolidated Schema
-- Dumped from develop database (lqpewpgwykzgpejtagiv) on 2026-04-13
-- Run this on a fresh Supabase database via the SQL Editor.
-- =============================================================================

--
-- PostgreSQL database dump
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA IF NOT EXISTS public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: execute_automations(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.execute_automations() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://login.snoek.app/api/automations/execute',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Supabase-Cron', 'true',
      'X-Cron-Secret', 'tZ9!pQ2v_mX8#nB5wK4*yR7jL1@uE6hC'
    ),
    body := '{}'::jsonb
  );
END;
$$;


ALTER FUNCTION public.execute_automations() OWNER TO postgres;

--
-- Name: get_client_members_with_email(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_client_members_with_email(p_client_id uuid) RETURNS TABLE(id uuid, client_id uuid, user_id uuid, created_at timestamp with time zone, role text, name text, avatar_url text, emails text[], role_title text, user_email character varying)
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


ALTER FUNCTION public.get_client_members_with_email(p_client_id uuid) OWNER TO postgres;

--
-- Name: get_user_client_ids(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_client_ids() RETURNS SETOF uuid
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


ALTER FUNCTION public.get_user_client_ids() OWNER TO postgres;

--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data ->> 'full_name', new.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;


ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

--
-- Name: is_super_admin(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_super_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;


ALTER FUNCTION public.is_super_admin() OWNER TO postgres;

--
-- Name: set_push_tokens_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_push_tokens_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_push_tokens_updated_at() OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: automation_conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.automation_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    automation_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.automation_conversations OWNER TO postgres;

--
-- Name: automation_execution_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.automation_execution_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    automation_id uuid NOT NULL,
    meeting_id uuid,
    log_key text NOT NULL,
    executed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.automation_execution_log OWNER TO postgres;

--
-- Name: automation_key_results; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.automation_key_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    automation_id uuid NOT NULL,
    quarterly_key_result_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.automation_key_results OWNER TO postgres;

--
-- Name: automation_meeting_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.automation_meeting_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    automation_id uuid NOT NULL,
    trigger_timing text NOT NULL,
    hours_offset integer DEFAULT 1 NOT NULL,
    meeting_type text,
    CONSTRAINT automation_meeting_config_trigger_timing_check CHECK ((trigger_timing = ANY (ARRAY['before'::text, 'after'::text])))
);


ALTER TABLE public.automation_meeting_config OWNER TO postgres;

--
-- Name: automation_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.automation_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    automation_id uuid NOT NULL,
    member_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.automation_members OWNER TO postgres;

--
-- Name: automation_recurring_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.automation_recurring_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    automation_id uuid NOT NULL,
    frequency text NOT NULL,
    day_of_week integer,
    day_of_month integer,
    time_of_day time without time zone NOT NULL,
    cron_job_name text,
    CONSTRAINT automation_recurring_config_frequency_check CHECK ((frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text])))
);


ALTER TABLE public.automation_recurring_config OWNER TO postgres;

--
-- Name: automation_scheduled_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.automation_scheduled_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    automation_id uuid NOT NULL,
    scheduled_at timestamp with time zone NOT NULL,
    conversation_id uuid,
    executed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.automation_scheduled_config OWNER TO postgres;

--
-- Name: automations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.automations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    coach_id uuid NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    message_content text NOT NULL,
    is_active boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT automations_type_check CHECK ((type = ANY (ARRAY['recurring'::text, 'meeting_trigger'::text, 'scheduled'::text])))
);


ALTER TABLE public.automations OWNER TO postgres;

--
-- Name: client_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.client_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    role text DEFAULT 'member'::text NOT NULL,
    name text NOT NULL,
    role_title text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now(),
    emails text[] DEFAULT '{}'::text[]
);


ALTER TABLE public.client_members OWNER TO postgres;

--
-- Name: clients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    coach_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    timezone text DEFAULT 'Europe/Amsterdam'::text,
    features text[] DEFAULT ARRAY[]::text[]
);


ALTER TABLE public.clients OWNER TO postgres;

--
-- Name: conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    coach_id uuid NOT NULL,
    member_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    is_group boolean DEFAULT false,
    name text
);


ALTER TABLE public.conversations OWNER TO postgres;

--
-- Name: goal_boards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.goal_boards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    title text NOT NULL,
    board_type text DEFAULT 'standard'::text NOT NULL,
    archived boolean DEFAULT false,
    "position" integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT goal_boards_board_type_check CHECK ((board_type = ANY (ARRAY['standard'::text, 'priorities'::text])))
);


ALTER TABLE public.goal_boards OWNER TO postgres;

--
-- Name: google_calendar_connections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.google_calendar_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid NOT NULL,
    google_access_token text NOT NULL,
    google_refresh_token text NOT NULL,
    google_calendar_id text NOT NULL,
    last_synced_at timestamp with time zone,
    sync_window_start date DEFAULT (CURRENT_DATE - '3 mons'::interval),
    sync_window_end date DEFAULT (CURRENT_DATE + '3 mons'::interval),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.google_calendar_connections OWNER TO postgres;

--
-- Name: invitations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    client_id uuid NOT NULL,
    role text NOT NULL,
    invited_by uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    token text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    member_id uuid,
    CONSTRAINT invitations_role_check CHECK ((role = ANY (ARRAY['member'::text, 'coach'::text]))),
    CONSTRAINT invitations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text])))
);


ALTER TABLE public.invitations OWNER TO postgres;

--
-- Name: journal_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.journal_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    journal_id uuid NOT NULL,
    period_key text NOT NULL,
    author_id uuid NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.journal_entries OWNER TO postgres;

--
-- Name: journals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.journals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    frequency text NOT NULL,
    assigned_member_id uuid,
    created_by uuid NOT NULL,
    archived boolean DEFAULT false NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT journals_frequency_check CHECK ((frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'biweekly'::text, 'monthly'::text])))
);


ALTER TABLE public.journals OWNER TO postgres;

--
-- Name: meeting_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.meeting_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    meeting_id uuid NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    document_type text DEFAULT 'notes'::text,
    embedding extensions.vector(1536),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT meeting_documents_document_type_check CHECK ((document_type = ANY (ARRAY['transcript'::text, 'notes'::text, 'other'::text])))
);


ALTER TABLE public.meeting_documents OWNER TO postgres;

--
-- Name: meetings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.meetings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    google_event_id text NOT NULL,
    title text NOT NULL,
    description text,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    attendee_emails text[] DEFAULT ARRAY[]::text[],
    member_ids uuid[] DEFAULT ARRAY[]::uuid[],
    status text DEFAULT 'scheduled'::text,
    has_documents boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT meetings_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'deleted_in_calendar'::text, 'rescheduled'::text])))
);


ALTER TABLE public.meetings OWNER TO postgres;

--
-- Name: message_journal_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.message_journal_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    journal_entry_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.message_journal_entries OWNER TO postgres;

--
-- Name: message_key_results; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.message_key_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    quarterly_key_result_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.message_key_results OWNER TO postgres;

--
-- Name: message_standard_goals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.message_standard_goals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    standard_goal_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.message_standard_goals OWNER TO postgres;

--
-- Name: messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    content text NOT NULL,
    key_result_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    reply_to_message_id uuid
);


ALTER TABLE public.messages OWNER TO postgres;

--
-- Name: metric_values; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.metric_values (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metric_id uuid NOT NULL,
    month integer NOT NULL,
    value numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.metric_values OWNER TO postgres;

--
-- Name: metrics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text,
    category text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.metrics OWNER TO postgres;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_super_admin boolean DEFAULT false
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: push_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.push_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    token text NOT NULL,
    platform text NOT NULL,
    disabled boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone,
    CONSTRAINT push_tokens_platform_check CHECK ((platform = ANY (ARRAY['ios'::text, 'android'::text])))
);


ALTER TABLE public.push_tokens OWNER TO postgres;

--
-- Name: quarterly_goals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quarterly_goals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    year integer NOT NULL,
    quarter integer NOT NULL,
    yearly_goal_id uuid,
    objective text NOT NULL,
    archived boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    "position" integer DEFAULT 0
);

ALTER TABLE ONLY public.quarterly_goals REPLICA IDENTITY FULL;


ALTER TABLE public.quarterly_goals OWNER TO postgres;

--
-- Name: quarterly_key_results; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quarterly_key_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quarterly_goal_id uuid NOT NULL,
    yearly_key_result_id uuid,
    title text NOT NULL,
    type text NOT NULL,
    target numeric NOT NULL,
    owner_id uuid,
    is_priority boolean DEFAULT false,
    confidence text DEFAULT 'not_started'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    target_frequency text DEFAULT 'quarterly'::text NOT NULL,
    "position" integer DEFAULT 0
);

ALTER TABLE ONLY public.quarterly_key_results REPLICA IDENTITY FULL;


ALTER TABLE public.quarterly_key_results OWNER TO postgres;

--
-- Name: standard_goal_values; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.standard_goal_values (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    standard_goal_id uuid NOT NULL,
    period_key text NOT NULL,
    value numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.standard_goal_values OWNER TO postgres;

--
-- Name: standard_goals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.standard_goals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    board_id uuid NOT NULL,
    goal_type text NOT NULL,
    title text NOT NULL,
    description text,
    target_value numeric DEFAULT 0 NOT NULL,
    value_type text DEFAULT 'number'::text NOT NULL,
    target_date date,
    check_in_frequency text,
    period text,
    owner_id uuid,
    is_priority boolean DEFAULT false,
    confidence text DEFAULT 'not_started'::text,
    "position" integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT standard_goals_frequency_check CHECK (((check_in_frequency IS NULL) OR (check_in_frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'biweekly'::text, 'monthly'::text, 'quarterly'::text, 'yearly'::text])))),
    CONSTRAINT standard_goals_goal_type_check CHECK ((goal_type = ANY (ARRAY['milestone'::text, 'periodic'::text]))),
    CONSTRAINT standard_goals_period_check CHECK (((period IS NULL) OR (period = ANY (ARRAY['daily'::text, 'weekly'::text, 'biweekly'::text, 'monthly'::text, 'quarterly'::text, 'yearly'::text])))),
    CONSTRAINT standard_goals_value_type_check CHECK ((value_type = ANY (ARRAY['number'::text, 'percentage'::text])))
);


ALTER TABLE public.standard_goals OWNER TO postgres;

--
-- Name: weekly_values; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.weekly_values (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quarterly_key_result_id uuid NOT NULL,
    week integer NOT NULL,
    value numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.weekly_values REPLICA IDENTITY FULL;


ALTER TABLE public.weekly_values OWNER TO postgres;

--
-- Name: yearly_goals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.yearly_goals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    year integer NOT NULL,
    objective text NOT NULL,
    archived boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    "position" integer DEFAULT 0
);

ALTER TABLE ONLY public.yearly_goals REPLICA IDENTITY FULL;


ALTER TABLE public.yearly_goals OWNER TO postgres;

--
-- Name: yearly_key_results; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.yearly_key_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    yearly_goal_id uuid NOT NULL,
    title text NOT NULL,
    confidence text DEFAULT 'not_started'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    "position" integer DEFAULT 0
);

ALTER TABLE ONLY public.yearly_key_results REPLICA IDENTITY FULL;


ALTER TABLE public.yearly_key_results OWNER TO postgres;

--
-- Data for Name: automation_conversations; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: automation_execution_log; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: automation_key_results; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: automation_meeting_config; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: automation_members; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: automation_recurring_config; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: automation_scheduled_config; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: automations; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: client_members; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: conversations; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: goal_boards; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: google_calendar_connections; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: invitations; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: journal_entries; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: journals; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: meeting_documents; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: meetings; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: message_journal_entries; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: message_key_results; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: message_standard_goals; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: metric_values; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: metrics; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: push_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: quarterly_goals; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: quarterly_key_results; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: standard_goal_values; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: standard_goals; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: weekly_values; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: yearly_goals; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: yearly_key_results; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Name: automation_conversations automation_conversations_automation_id_conversation_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automation_conversations
    ADD CONSTRAINT automation_conversations_automation_id_conversation_id_key UNIQUE (automation_id, conversation_id);


--
-- Name: automation_conversations automation_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automation_conversations
    ADD CONSTRAINT automation_conversations_pkey PRIMARY KEY (id);


--
-- Name: automation_execution_log automation_execution_log_log_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automation_execution_log
    ADD CONSTRAINT automation_execution_log_log_key_key UNIQUE (log_key);


--
-- Name: automation_execution_log automation_execution_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automation_execution_log
    ADD CONSTRAINT automation_execution_log_pkey PRIMARY KEY (id);


--
-- Name: automation_key_results automation_key_results_automation_id_quarterly_key_result_i_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automation_key_results
    ADD CONSTRAINT automation_key_results_automation_id_quarterly_key_result_i_key UNIQUE (automation_id, quarterly_key_result_id);


--
-- Name: automation_key_results automation_key_results_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automation_key_results
    ADD CONSTRAINT automation_key_results_pkey PRIMARY KEY (id);


--
-- Name: automation_meeting_config automation_meeting_config_automation_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automation_meeting_config
    ADD CONSTRAINT automation_meeting_config_automation_id_key UNIQUE (automation_id);


--
-- Name: automation_meeting_config automation_meeting_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automation_meeting_config
    ADD CONSTRAINT automation_meeting_config_pkey PRIMARY KEY (id);


--
-- Name: automation_members automation_members_automation_id_member_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automation_members
    ADD CONSTRAINT automation_members_automation_id_member_id_key UNIQUE (automation_id, member_id);


--
-- Name: automation_members automation_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automation_members
    ADD CONSTRAINT automation_members_pkey PRIMARY KEY (id);


--
-- Name: automation_recurring_config automation_recurring_config_automation_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automation_recurring_config
    ADD CONSTRAINT automation_recurring_config_automation_id_key UNIQUE (automation_id);


--
-- Name: automation_recurring_config automation_recurring_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automation_recurring_config
    ADD CONSTRAINT automation_recurring_config_pkey PRIMARY KEY (id);


--
-- Name: automation_scheduled_config automation_scheduled_config_automation_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automation_scheduled_config
    ADD CONSTRAINT automation_scheduled_config_automation_id_key UNIQUE (automation_id);


--
-- Name: automation_scheduled_config automation_scheduled_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automation_scheduled_config
    ADD CONSTRAINT automation_scheduled_config_pkey PRIMARY KEY (id);


--
-- Name: automations automations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automations
    ADD CONSTRAINT automations_pkey PRIMARY KEY (id);


--
-- Name: client_members client_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_members
    ADD CONSTRAINT client_members_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_client_id_coach_id_member_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_client_id_coach_id_member_id_key UNIQUE (client_id, coach_id, member_id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: goal_boards goal_boards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.goal_boards
    ADD CONSTRAINT goal_boards_pkey PRIMARY KEY (id);


--
-- Name: google_calendar_connections google_calendar_connections_client_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.google_calendar_connections
    ADD CONSTRAINT google_calendar_connections_client_id_user_id_key UNIQUE (client_id, user_id);


--
-- Name: google_calendar_connections google_calendar_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.google_calendar_connections
    ADD CONSTRAINT google_calendar_connections_pkey PRIMARY KEY (id);


--
-- Name: invitations invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_pkey PRIMARY KEY (id);


--
-- Name: invitations invitations_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_token_key UNIQUE (token);


--
-- Name: journal_entries journal_entries_journal_id_period_key_author_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_journal_id_period_key_author_id_key UNIQUE (journal_id, period_key, author_id);


--
-- Name: journal_entries journal_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_pkey PRIMARY KEY (id);


--
-- Name: journals journals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journals
    ADD CONSTRAINT journals_pkey PRIMARY KEY (id);


--
-- Name: meeting_documents meeting_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.meeting_documents
    ADD CONSTRAINT meeting_documents_pkey PRIMARY KEY (id);


--
-- Name: meetings meetings_client_id_google_event_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_client_id_google_event_id_key UNIQUE (client_id, google_event_id);


--
-- Name: meetings meetings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_pkey PRIMARY KEY (id);


--
-- Name: message_journal_entries message_journal_entries_message_id_journal_entry_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_journal_entries
    ADD CONSTRAINT message_journal_entries_message_id_journal_entry_id_key UNIQUE (message_id, journal_entry_id);


--
-- Name: message_journal_entries message_journal_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_journal_entries
    ADD CONSTRAINT message_journal_entries_pkey PRIMARY KEY (id);


--
-- Name: message_key_results message_key_results_message_id_quarterly_key_result_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_key_results
    ADD CONSTRAINT message_key_results_message_id_quarterly_key_result_id_key UNIQUE (message_id, quarterly_key_result_id);


--
-- Name: message_key_results message_key_results_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_key_results
    ADD CONSTRAINT message_key_results_pkey PRIMARY KEY (id);


--
-- Name: message_standard_goals message_standard_goals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_standard_goals
    ADD CONSTRAINT message_standard_goals_pkey PRIMARY KEY (id);


--
-- Name: message_standard_goals message_standard_goals_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_standard_goals
    ADD CONSTRAINT message_standard_goals_unique UNIQUE (message_id, standard_goal_id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: metric_values metric_values_metric_id_month_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.metric_values
    ADD CONSTRAINT metric_values_metric_id_month_key UNIQUE (metric_id, month);


--
-- Name: metric_values metric_values_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.metric_values
    ADD CONSTRAINT metric_values_pkey PRIMARY KEY (id);


--
-- Name: metrics metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.metrics
    ADD CONSTRAINT metrics_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: push_tokens push_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_pkey PRIMARY KEY (id);


--
-- Name: quarterly_goals quarterly_goals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quarterly_goals
    ADD CONSTRAINT quarterly_goals_pkey PRIMARY KEY (id);


--
-- Name: quarterly_key_results quarterly_key_results_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quarterly_key_results
    ADD CONSTRAINT quarterly_key_results_pkey PRIMARY KEY (id);


--
-- Name: standard_goal_values standard_goal_values_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.standard_goal_values
    ADD CONSTRAINT standard_goal_values_pkey PRIMARY KEY (id);


--
-- Name: standard_goal_values standard_goal_values_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.standard_goal_values
    ADD CONSTRAINT standard_goal_values_unique UNIQUE (standard_goal_id, period_key);


--
-- Name: standard_goals standard_goals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.standard_goals
    ADD CONSTRAINT standard_goals_pkey PRIMARY KEY (id);


--
-- Name: weekly_values weekly_values_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.weekly_values
    ADD CONSTRAINT weekly_values_pkey PRIMARY KEY (id);


--
-- Name: weekly_values weekly_values_quarterly_key_result_id_week_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.weekly_values
    ADD CONSTRAINT weekly_values_quarterly_key_result_id_week_key UNIQUE (quarterly_key_result_id, week);


--
-- Name: yearly_goals yearly_goals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.yearly_goals
    ADD CONSTRAINT yearly_goals_pkey PRIMARY KEY (id);


--
-- Name: yearly_key_results yearly_key_results_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.yearly_key_results
    ADD CONSTRAINT yearly_key_results_pkey PRIMARY KEY (id);


--
-- Name: conversations_client_group_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX conversations_client_group_unique ON public.conversations USING btree (client_id) WHERE (is_group = true);


--
-- Name: idx_automation_conversations_automation; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_automation_conversations_automation ON public.automation_conversations USING btree (automation_id);


--
-- Name: idx_automation_execution_log_automation; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_automation_execution_log_automation ON public.automation_execution_log USING btree (automation_id);


--
-- Name: idx_automation_execution_log_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_automation_execution_log_key ON public.automation_execution_log USING btree (log_key);


--
-- Name: idx_automation_key_results_automation_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_automation_key_results_automation_id ON public.automation_key_results USING btree (automation_id);


--
-- Name: idx_automation_meeting_config_automation_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_automation_meeting_config_automation_id ON public.automation_meeting_config USING btree (automation_id);


--
-- Name: idx_automation_members_automation_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_automation_members_automation_id ON public.automation_members USING btree (automation_id);


--
-- Name: idx_automation_members_member_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_automation_members_member_id ON public.automation_members USING btree (member_id);


--
-- Name: idx_automation_recurring_config_automation_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_automation_recurring_config_automation_id ON public.automation_recurring_config USING btree (automation_id);


--
-- Name: idx_automations_client_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_automations_client_id ON public.automations USING btree (client_id);


--
-- Name: idx_automations_coach_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_automations_coach_id ON public.automations USING btree (coach_id);


--
-- Name: idx_automations_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_automations_is_active ON public.automations USING btree (is_active);


--
-- Name: idx_client_members_client_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_client_members_client_id ON public.client_members USING btree (client_id);


--
-- Name: idx_client_members_emails; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_client_members_emails ON public.client_members USING gin (emails);


--
-- Name: idx_client_members_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_client_members_user_id ON public.client_members USING btree (user_id);


--
-- Name: idx_clients_coach_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clients_coach_id ON public.clients USING btree (coach_id);


--
-- Name: idx_goal_boards_client; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_goal_boards_client ON public.goal_boards USING btree (client_id);


--
-- Name: idx_google_calendar_connections_client; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_google_calendar_connections_client ON public.google_calendar_connections USING btree (client_id);


--
-- Name: idx_google_calendar_connections_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_google_calendar_connections_user ON public.google_calendar_connections USING btree (user_id);


--
-- Name: idx_invitations_client_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invitations_client_id ON public.invitations USING btree (client_id);


--
-- Name: idx_invitations_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invitations_email ON public.invitations USING btree (email);


--
-- Name: idx_invitations_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invitations_token ON public.invitations USING btree (token);


--
-- Name: idx_journal_entries_author_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_journal_entries_author_id ON public.journal_entries USING btree (author_id);


--
-- Name: idx_journal_entries_journal_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_journal_entries_journal_id ON public.journal_entries USING btree (journal_id);


--
-- Name: idx_journals_client_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_journals_client_id ON public.journals USING btree (client_id);


--
-- Name: idx_meeting_documents_embedding; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_meeting_documents_embedding ON public.meeting_documents USING ivfflat (embedding extensions.vector_cosine_ops);


--
-- Name: idx_meeting_documents_meeting; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_meeting_documents_meeting ON public.meeting_documents USING btree (meeting_id);


--
-- Name: idx_meetings_client; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_meetings_client ON public.meetings USING btree (client_id);


--
-- Name: idx_meetings_start_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_meetings_start_time ON public.meetings USING btree (client_id, start_time DESC);


--
-- Name: idx_message_journal_entries_message_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_message_journal_entries_message_id ON public.message_journal_entries USING btree (message_id);


--
-- Name: idx_message_key_results_message_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_message_key_results_message_id ON public.message_key_results USING btree (message_id);


--
-- Name: idx_messages_conversation_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_conversation_id ON public.messages USING btree (conversation_id);


--
-- Name: idx_messages_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_created_at ON public.messages USING btree (created_at);


--
-- Name: idx_messages_reply_to_message_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_reply_to_message_id ON public.messages USING btree (reply_to_message_id);


--
-- Name: idx_metric_values_metric_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_metric_values_metric_id ON public.metric_values USING btree (metric_id);


--
-- Name: idx_metrics_client_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_metrics_client_id ON public.metrics USING btree (client_id);


--
-- Name: idx_quarterly_goals_client_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quarterly_goals_client_id ON public.quarterly_goals USING btree (client_id);


--
-- Name: idx_quarterly_key_results_goal_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quarterly_key_results_goal_id ON public.quarterly_key_results USING btree (quarterly_goal_id);


--
-- Name: idx_standard_goal_values_goal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_standard_goal_values_goal ON public.standard_goal_values USING btree (standard_goal_id);


--
-- Name: idx_standard_goals_board; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_standard_goals_board ON public.standard_goals USING btree (board_id);


--
-- Name: idx_weekly_values_kr_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_weekly_values_kr_id ON public.weekly_values USING btree (quarterly_key_result_id);


--
-- Name: idx_yearly_goals_client_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_yearly_goals_client_id ON public.yearly_goals USING btree (client_id);


--
-- Name: push_tokens_user_token_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX push_tokens_user_token_key ON public.push_tokens USING btree (user_id, token);


--
-- Name: push_tokens set_push_tokens_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_push_tokens_updated_at BEFORE UPDATE ON public.push_tokens FOR EACH ROW EXECUTE FUNCTION public.set_push_tokens_updated_at();


--
-- Name: journal_entries update_journal_entries_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_journal_entries_updated_at BEFORE UPDATE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: journals update_journals_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_journals_updated_at BEFORE UPDATE ON public.journals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: automation_conversations automation_conversations_automation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automation_conversations
    ADD CONSTRAINT automation_conversations_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES public.automations(id) ON DELETE CASCADE;


--
-- Name: automation_conversations automation_conversations_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automation_conversations
    ADD CONSTRAINT automation_conversations_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: automation_execution_log automation_execution_log_automation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automation_execution_log
    ADD CONSTRAINT automation_execution_log_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES public.automations(id) ON DELETE CASCADE;


--
-- Name: automation_execution_log automation_execution_log_meeting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automation_execution_log
    ADD CONSTRAINT automation_execution_log_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.meetings(id) ON DELETE SET NULL;


--
-- Name: automation_key_results automation_key_results_automation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automation_key_results
    ADD CONSTRAINT automation_key_results_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES public.automations(id) ON DELETE CASCADE;


--
-- Name: automation_key_results automation_key_results_quarterly_key_result_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automation_key_results
    ADD CONSTRAINT automation_key_results_quarterly_key_result_id_fkey FOREIGN KEY (quarterly_key_result_id) REFERENCES public.quarterly_key_results(id) ON DELETE CASCADE;


--
-- Name: automation_meeting_config automation_meeting_config_automation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automation_meeting_config
    ADD CONSTRAINT automation_meeting_config_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES public.automations(id) ON DELETE CASCADE;


--
-- Name: automation_members automation_members_automation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automation_members
    ADD CONSTRAINT automation_members_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES public.automations(id) ON DELETE CASCADE;


--
-- Name: automation_members automation_members_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automation_members
    ADD CONSTRAINT automation_members_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.client_members(id) ON DELETE CASCADE;


--
-- Name: automation_recurring_config automation_recurring_config_automation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automation_recurring_config
    ADD CONSTRAINT automation_recurring_config_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES public.automations(id) ON DELETE CASCADE;


--
-- Name: automation_scheduled_config automation_scheduled_config_automation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automation_scheduled_config
    ADD CONSTRAINT automation_scheduled_config_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES public.automations(id) ON DELETE CASCADE;


--
-- Name: automation_scheduled_config automation_scheduled_config_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automation_scheduled_config
    ADD CONSTRAINT automation_scheduled_config_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE SET NULL;


--
-- Name: automations automations_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automations
    ADD CONSTRAINT automations_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: automations automations_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automations
    ADD CONSTRAINT automations_company_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: clients companies_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT companies_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: client_members company_members_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_members
    ADD CONSTRAINT company_members_company_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: client_members company_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_members
    ADD CONSTRAINT company_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_company_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_founder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_founder_id_fkey FOREIGN KEY (member_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: goal_boards goal_boards_company_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.goal_boards
    ADD CONSTRAINT goal_boards_company_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: google_calendar_connections google_calendar_connections_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.google_calendar_connections
    ADD CONSTRAINT google_calendar_connections_company_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: google_calendar_connections google_calendar_connections_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.google_calendar_connections
    ADD CONSTRAINT google_calendar_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: invitations invitations_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_company_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: invitations invitations_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: invitations invitations_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.client_members(id) ON DELETE SET NULL;


--
-- Name: journal_entries journal_entries_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id);


--
-- Name: journal_entries journal_entries_journal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_journal_id_fkey FOREIGN KEY (journal_id) REFERENCES public.journals(id) ON DELETE CASCADE;


--
-- Name: journals journals_assigned_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journals
    ADD CONSTRAINT journals_assigned_member_id_fkey FOREIGN KEY (assigned_member_id) REFERENCES public.client_members(id) ON DELETE SET NULL;


--
-- Name: journals journals_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journals
    ADD CONSTRAINT journals_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: journals journals_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journals
    ADD CONSTRAINT journals_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: meeting_documents meeting_documents_meeting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.meeting_documents
    ADD CONSTRAINT meeting_documents_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.meetings(id) ON DELETE CASCADE;


--
-- Name: meetings meetings_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_company_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: message_journal_entries message_journal_entries_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_journal_entries
    ADD CONSTRAINT message_journal_entries_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id) ON DELETE CASCADE;


--
-- Name: message_journal_entries message_journal_entries_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_journal_entries
    ADD CONSTRAINT message_journal_entries_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: message_key_results message_key_results_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_key_results
    ADD CONSTRAINT message_key_results_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: message_key_results message_key_results_quarterly_key_result_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_key_results
    ADD CONSTRAINT message_key_results_quarterly_key_result_id_fkey FOREIGN KEY (quarterly_key_result_id) REFERENCES public.quarterly_key_results(id) ON DELETE CASCADE;


--
-- Name: message_standard_goals message_standard_goals_goal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_standard_goals
    ADD CONSTRAINT message_standard_goals_goal_fkey FOREIGN KEY (standard_goal_id) REFERENCES public.standard_goals(id) ON DELETE CASCADE;


--
-- Name: message_standard_goals message_standard_goals_message_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_standard_goals
    ADD CONSTRAINT message_standard_goals_message_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: messages messages_key_result_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_key_result_id_fkey FOREIGN KEY (key_result_id) REFERENCES public.quarterly_key_results(id) ON DELETE SET NULL;


--
-- Name: messages messages_reply_to_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_reply_to_message_id_fkey FOREIGN KEY (reply_to_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: metric_values metric_values_metric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.metric_values
    ADD CONSTRAINT metric_values_metric_id_fkey FOREIGN KEY (metric_id) REFERENCES public.metrics(id) ON DELETE CASCADE;


--
-- Name: metrics metrics_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.metrics
    ADD CONSTRAINT metrics_company_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: quarterly_goals quarterly_goals_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quarterly_goals
    ADD CONSTRAINT quarterly_goals_company_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: quarterly_goals quarterly_goals_yearly_goal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quarterly_goals
    ADD CONSTRAINT quarterly_goals_yearly_goal_id_fkey FOREIGN KEY (yearly_goal_id) REFERENCES public.yearly_goals(id) ON DELETE SET NULL;


--
-- Name: quarterly_key_results quarterly_key_results_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quarterly_key_results
    ADD CONSTRAINT quarterly_key_results_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.client_members(id) ON DELETE SET NULL;


--
-- Name: quarterly_key_results quarterly_key_results_quarterly_goal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quarterly_key_results
    ADD CONSTRAINT quarterly_key_results_quarterly_goal_id_fkey FOREIGN KEY (quarterly_goal_id) REFERENCES public.quarterly_goals(id) ON DELETE CASCADE;


--
-- Name: quarterly_key_results quarterly_key_results_yearly_key_result_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quarterly_key_results
    ADD CONSTRAINT quarterly_key_results_yearly_key_result_id_fkey FOREIGN KEY (yearly_key_result_id) REFERENCES public.yearly_key_results(id) ON DELETE SET NULL;


--
-- Name: standard_goal_values standard_goal_values_goal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.standard_goal_values
    ADD CONSTRAINT standard_goal_values_goal_fkey FOREIGN KEY (standard_goal_id) REFERENCES public.standard_goals(id) ON DELETE CASCADE;


--
-- Name: standard_goals standard_goals_board_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.standard_goals
    ADD CONSTRAINT standard_goals_board_fkey FOREIGN KEY (board_id) REFERENCES public.goal_boards(id) ON DELETE CASCADE;


--
-- Name: standard_goals standard_goals_owner_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.standard_goals
    ADD CONSTRAINT standard_goals_owner_fkey FOREIGN KEY (owner_id) REFERENCES public.client_members(id) ON DELETE SET NULL;


--
-- Name: weekly_values weekly_values_quarterly_key_result_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.weekly_values
    ADD CONSTRAINT weekly_values_quarterly_key_result_id_fkey FOREIGN KEY (quarterly_key_result_id) REFERENCES public.quarterly_key_results(id) ON DELETE CASCADE;


--
-- Name: yearly_goals yearly_goals_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.yearly_goals
    ADD CONSTRAINT yearly_goals_company_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: yearly_key_results yearly_key_results_yearly_goal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.yearly_key_results
    ADD CONSTRAINT yearly_key_results_yearly_goal_id_fkey FOREIGN KEY (yearly_goal_id) REFERENCES public.yearly_goals(id) ON DELETE CASCADE;


--
-- Name: invitations Anyone can view invitations by token; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view invitations by token" ON public.invitations FOR SELECT USING (true);


--
-- Name: invitations Coaches can create invitations for their clients; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Coaches can create invitations for their clients" ON public.invitations FOR INSERT WITH CHECK ((((invited_by = auth.uid()) AND (client_id IN ( SELECT clients.id
   FROM public.clients
  WHERE (clients.coach_id = auth.uid())))) OR public.is_super_admin()));


--
-- Name: invitations Coaches can delete their client invitations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Coaches can delete their client invitations" ON public.invitations FOR DELETE USING ((((invited_by = auth.uid()) AND (client_id IN ( SELECT clients.id
   FROM public.clients
  WHERE (clients.coach_id = auth.uid())))) OR public.is_super_admin()));


--
-- Name: invitations Coaches can update their client invitations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Coaches can update their client invitations" ON public.invitations FOR UPDATE USING ((((invited_by = auth.uid()) AND (client_id IN ( SELECT clients.id
   FROM public.clients
  WHERE (clients.coach_id = auth.uid())))) OR public.is_super_admin()));


--
-- Name: invitations Coaches can view their client invitations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Coaches can view their client invitations" ON public.invitations FOR SELECT USING (((client_id IN ( SELECT clients.id
   FROM public.clients
  WHERE (clients.coach_id = auth.uid()))) OR (invited_by = auth.uid()) OR public.is_super_admin()));


--
-- Name: automation_execution_log Service role can manage execution logs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role can manage execution logs" ON public.automation_execution_log USING (true) WITH CHECK (true);


--
-- Name: invitations Users can accept their own invitations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can accept their own invitations" ON public.invitations FOR UPDATE USING (((email = (auth.jwt() ->> 'email'::text)) OR true)) WITH CHECK ((status = 'accepted'::text));


--
-- Name: automation_conversations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.automation_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: automation_conversations automation_conversations_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY automation_conversations_delete ON public.automation_conversations FOR DELETE USING (((EXISTS ( SELECT 1
   FROM public.automations a
  WHERE ((a.id = automation_conversations.automation_id) AND (a.coach_id = auth.uid())))) OR public.is_super_admin()));


--
-- Name: automation_conversations automation_conversations_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY automation_conversations_insert ON public.automation_conversations FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM public.automations a
  WHERE ((a.id = automation_conversations.automation_id) AND (a.coach_id = auth.uid())))) OR public.is_super_admin()));


--
-- Name: automation_conversations automation_conversations_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY automation_conversations_select ON public.automation_conversations FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.automations a
  WHERE ((a.id = automation_conversations.automation_id) AND (a.coach_id = auth.uid())))) OR public.is_super_admin()));


--
-- Name: automation_execution_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.automation_execution_log ENABLE ROW LEVEL SECURITY;

--
-- Name: automation_key_results; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.automation_key_results ENABLE ROW LEVEL SECURITY;

--
-- Name: automation_key_results automation_kr_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY automation_kr_delete ON public.automation_key_results FOR DELETE USING (((EXISTS ( SELECT 1
   FROM public.automations
  WHERE ((automations.id = automation_key_results.automation_id) AND (automations.coach_id = auth.uid())))) OR public.is_super_admin()));


--
-- Name: automation_key_results automation_kr_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY automation_kr_insert ON public.automation_key_results FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM public.automations
  WHERE ((automations.id = automation_key_results.automation_id) AND (automations.coach_id = auth.uid())))) OR public.is_super_admin()));


--
-- Name: automation_key_results automation_kr_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY automation_kr_select ON public.automation_key_results FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.automations
  WHERE ((automations.id = automation_key_results.automation_id) AND ((automations.coach_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.client_members
          WHERE ((client_members.client_id = automations.client_id) AND (client_members.user_id = auth.uid()) AND (client_members.role = 'coach'::text)))))))) OR public.is_super_admin()));


--
-- Name: automation_meeting_config; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.automation_meeting_config ENABLE ROW LEVEL SECURITY;

--
-- Name: automation_members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.automation_members ENABLE ROW LEVEL SECURITY;

--
-- Name: automation_members automation_members_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY automation_members_delete ON public.automation_members FOR DELETE USING (((EXISTS ( SELECT 1
   FROM public.automations
  WHERE ((automations.id = automation_members.automation_id) AND (automations.coach_id = auth.uid())))) OR public.is_super_admin()));


--
-- Name: automation_members automation_members_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY automation_members_insert ON public.automation_members FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM public.automations
  WHERE ((automations.id = automation_members.automation_id) AND (automations.coach_id = auth.uid())))) OR public.is_super_admin()));


--
-- Name: automation_members automation_members_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY automation_members_select ON public.automation_members FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.automations
  WHERE ((automations.id = automation_members.automation_id) AND ((automations.coach_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.client_members
          WHERE ((client_members.client_id = automations.client_id) AND (client_members.user_id = auth.uid()) AND (client_members.role = 'coach'::text)))))))) OR public.is_super_admin()));


--
-- Name: automation_recurring_config; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.automation_recurring_config ENABLE ROW LEVEL SECURITY;

--
-- Name: automation_scheduled_config; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.automation_scheduled_config ENABLE ROW LEVEL SECURITY;

--
-- Name: automations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;

--
-- Name: automations automations_delete_coach; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY automations_delete_coach ON public.automations FOR DELETE USING (((coach_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.client_members
  WHERE ((client_members.client_id = automations.client_id) AND (client_members.user_id = auth.uid()) AND (client_members.role = 'coach'::text)))) OR public.is_super_admin()));


--
-- Name: automations automations_insert_coach; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY automations_insert_coach ON public.automations FOR INSERT WITH CHECK ((((coach_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.client_members
  WHERE ((client_members.client_id = automations.client_id) AND (client_members.user_id = auth.uid()) AND (client_members.role = 'coach'::text))))) OR public.is_super_admin()));


--
-- Name: automations automations_select_coach; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY automations_select_coach ON public.automations FOR SELECT USING (((coach_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.client_members
  WHERE ((client_members.client_id = automations.client_id) AND (client_members.user_id = auth.uid()) AND (client_members.role = 'coach'::text)))) OR public.is_super_admin()));


--
-- Name: automations automations_update_coach; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY automations_update_coach ON public.automations FOR UPDATE USING (((coach_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.client_members
  WHERE ((client_members.client_id = automations.client_id) AND (client_members.user_id = auth.uid()) AND (client_members.role = 'coach'::text)))) OR public.is_super_admin()));


--
-- Name: client_members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.client_members ENABLE ROW LEVEL SECURITY;

--
-- Name: client_members client_members_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY client_members_delete ON public.client_members FOR DELETE USING ((client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)));


--
-- Name: client_members client_members_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY client_members_insert ON public.client_members FOR INSERT TO authenticated WITH CHECK (((EXISTS ( SELECT 1
   FROM public.clients c
  WHERE ((c.id = client_members.client_id) AND (c.coach_id = auth.uid())))) OR (user_id = auth.uid()) OR public.is_super_admin()));


--
-- Name: client_members client_members_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY client_members_select ON public.client_members FOR SELECT USING ((client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)));


--
-- Name: client_members client_members_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY client_members_update ON public.client_members FOR UPDATE USING ((client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)));


--
-- Name: clients; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

--
-- Name: clients clients_delete_coach; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY clients_delete_coach ON public.clients FOR DELETE USING (((auth.uid() = coach_id) OR public.is_super_admin()));


--
-- Name: clients clients_insert_coach; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY clients_insert_coach ON public.clients FOR INSERT WITH CHECK (((auth.uid() = coach_id) OR public.is_super_admin()));


--
-- Name: clients clients_select_member; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY clients_select_member ON public.clients FOR SELECT USING ((id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)));


--
-- Name: clients clients_update_coach; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY clients_update_coach ON public.clients FOR UPDATE USING (((auth.uid() = coach_id) OR public.is_super_admin()));


--
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations conversations_insert_coach; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY conversations_insert_coach ON public.conversations FOR INSERT WITH CHECK ((((auth.uid() = coach_id) AND (client_id IN ( SELECT cm.client_id
   FROM public.client_members cm
  WHERE ((cm.user_id = auth.uid()) AND (cm.role = 'coach'::text))))) OR public.is_super_admin()));


--
-- Name: conversations conversations_select_participant; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY conversations_select_participant ON public.conversations FOR SELECT USING (((auth.uid() = coach_id) OR (auth.uid() = member_id) OR ((is_group = true) AND (EXISTS ( SELECT 1
   FROM public.client_members cm
  WHERE ((cm.client_id = conversations.client_id) AND (cm.user_id = auth.uid()))))) OR public.is_super_admin()));


--
-- Name: goal_boards; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.goal_boards ENABLE ROW LEVEL SECURITY;

--
-- Name: goal_boards goal_boards_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY goal_boards_delete ON public.goal_boards FOR DELETE USING ((client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)));


--
-- Name: goal_boards goal_boards_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY goal_boards_insert ON public.goal_boards FOR INSERT WITH CHECK ((client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)));


--
-- Name: goal_boards goal_boards_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY goal_boards_select ON public.goal_boards FOR SELECT USING ((client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)));


--
-- Name: goal_boards goal_boards_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY goal_boards_update ON public.goal_boards FOR UPDATE USING ((client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)));


--
-- Name: google_calendar_connections; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: google_calendar_connections google_calendar_connections_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY google_calendar_connections_delete ON public.google_calendar_connections FOR DELETE USING (((user_id = auth.uid()) OR public.is_super_admin()));


--
-- Name: google_calendar_connections google_calendar_connections_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY google_calendar_connections_insert ON public.google_calendar_connections FOR INSERT WITH CHECK (((client_id IN ( SELECT cm.client_id
   FROM public.client_members cm
  WHERE ((cm.user_id = auth.uid()) AND (cm.role = 'coach'::text)))) OR public.is_super_admin()));


--
-- Name: google_calendar_connections google_calendar_connections_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY google_calendar_connections_select ON public.google_calendar_connections FOR SELECT USING (((user_id = auth.uid()) OR (client_id IN ( SELECT cm.client_id
   FROM public.client_members cm
  WHERE ((cm.user_id = auth.uid()) AND (cm.role = 'coach'::text)))) OR public.is_super_admin()));


--
-- Name: google_calendar_connections google_calendar_connections_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY google_calendar_connections_update ON public.google_calendar_connections FOR UPDATE USING (((user_id = auth.uid()) OR public.is_super_admin()));


--
-- Name: invitations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: journal_entries; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: journal_entries journal_entries_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY journal_entries_delete ON public.journal_entries FOR DELETE USING ((journal_id IN ( SELECT journals.id
   FROM public.journals
  WHERE (journals.client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)))));


--
-- Name: journal_entries journal_entries_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY journal_entries_insert ON public.journal_entries FOR INSERT WITH CHECK ((journal_id IN ( SELECT journals.id
   FROM public.journals
  WHERE (journals.client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)))));


--
-- Name: journal_entries journal_entries_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY journal_entries_select ON public.journal_entries FOR SELECT USING ((journal_id IN ( SELECT journals.id
   FROM public.journals
  WHERE (journals.client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)))));


--
-- Name: journal_entries journal_entries_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY journal_entries_update ON public.journal_entries FOR UPDATE USING ((journal_id IN ( SELECT journals.id
   FROM public.journals
  WHERE (journals.client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)))));


--
-- Name: journals; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.journals ENABLE ROW LEVEL SECURITY;

--
-- Name: journals journals_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY journals_delete ON public.journals FOR DELETE USING ((client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)));


--
-- Name: journals journals_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY journals_insert ON public.journals FOR INSERT WITH CHECK ((client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)));


--
-- Name: journals journals_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY journals_select ON public.journals FOR SELECT USING ((client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)));


--
-- Name: journals journals_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY journals_update ON public.journals FOR UPDATE USING ((client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)));


--
-- Name: automation_meeting_config meeting_config_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY meeting_config_delete ON public.automation_meeting_config FOR DELETE USING (((EXISTS ( SELECT 1
   FROM public.automations
  WHERE ((automations.id = automation_meeting_config.automation_id) AND (automations.coach_id = auth.uid())))) OR public.is_super_admin()));


--
-- Name: automation_meeting_config meeting_config_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY meeting_config_insert ON public.automation_meeting_config FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM public.automations
  WHERE ((automations.id = automation_meeting_config.automation_id) AND (automations.coach_id = auth.uid())))) OR public.is_super_admin()));


--
-- Name: automation_meeting_config meeting_config_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY meeting_config_select ON public.automation_meeting_config FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.automations
  WHERE ((automations.id = automation_meeting_config.automation_id) AND ((automations.coach_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.client_members
          WHERE ((client_members.client_id = automations.client_id) AND (client_members.user_id = auth.uid()) AND (client_members.role = 'coach'::text)))))))) OR public.is_super_admin()));


--
-- Name: automation_meeting_config meeting_config_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY meeting_config_update ON public.automation_meeting_config FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM public.automations
  WHERE ((automations.id = automation_meeting_config.automation_id) AND (automations.coach_id = auth.uid())))) OR public.is_super_admin()));


--
-- Name: meeting_documents; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.meeting_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: meeting_documents meeting_documents_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY meeting_documents_delete ON public.meeting_documents FOR DELETE USING (((meeting_id IN ( SELECT m.id
   FROM public.meetings m
  WHERE (m.client_id IN ( SELECT cm.client_id
           FROM public.client_members cm
          WHERE (cm.user_id = auth.uid()))))) OR public.is_super_admin()));


--
-- Name: meeting_documents meeting_documents_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY meeting_documents_insert ON public.meeting_documents FOR INSERT WITH CHECK (((meeting_id IN ( SELECT m.id
   FROM public.meetings m
  WHERE (m.client_id IN ( SELECT cm.client_id
           FROM public.client_members cm
          WHERE (cm.user_id = auth.uid()))))) OR public.is_super_admin()));


--
-- Name: meeting_documents meeting_documents_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY meeting_documents_select ON public.meeting_documents FOR SELECT USING (((meeting_id IN ( SELECT m.id
   FROM public.meetings m
  WHERE (m.client_id IN ( SELECT cm.client_id
           FROM public.client_members cm
          WHERE (cm.user_id = auth.uid()))))) OR public.is_super_admin()));


--
-- Name: meeting_documents meeting_documents_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY meeting_documents_update ON public.meeting_documents FOR UPDATE USING (((meeting_id IN ( SELECT m.id
   FROM public.meetings m
  WHERE (m.client_id IN ( SELECT cm.client_id
           FROM public.client_members cm
          WHERE (cm.user_id = auth.uid()))))) OR public.is_super_admin()));


--
-- Name: meetings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

--
-- Name: meetings meetings_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY meetings_delete ON public.meetings FOR DELETE USING (((client_id IN ( SELECT cm.client_id
   FROM public.client_members cm
  WHERE ((cm.user_id = auth.uid()) AND (cm.role = 'coach'::text)))) OR public.is_super_admin()));


--
-- Name: meetings meetings_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY meetings_insert ON public.meetings FOR INSERT WITH CHECK (((client_id IN ( SELECT cm.client_id
   FROM public.client_members cm
  WHERE ((cm.user_id = auth.uid()) AND (cm.role = 'coach'::text)))) OR public.is_super_admin()));


--
-- Name: meetings meetings_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY meetings_select ON public.meetings FOR SELECT USING (((client_id IN ( SELECT cm.client_id
   FROM public.client_members cm
  WHERE (cm.user_id = auth.uid()))) OR public.is_super_admin()));


--
-- Name: meetings meetings_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY meetings_update ON public.meetings FOR UPDATE USING (((client_id IN ( SELECT cm.client_id
   FROM public.client_members cm
  WHERE ((cm.user_id = auth.uid()) AND (cm.role = 'coach'::text)))) OR public.is_super_admin()));


--
-- Name: message_journal_entries; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.message_journal_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: message_journal_entries message_journal_entries_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY message_journal_entries_insert ON public.message_journal_entries FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM (public.messages m
     JOIN public.conversations c ON ((c.id = m.conversation_id)))
  WHERE ((m.id = message_journal_entries.message_id) AND (m.sender_id = auth.uid()) AND ((c.coach_id = auth.uid()) OR (c.member_id = auth.uid()))))) OR public.is_super_admin()));


--
-- Name: message_journal_entries message_journal_entries_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY message_journal_entries_select ON public.message_journal_entries FOR SELECT USING (((EXISTS ( SELECT 1
   FROM (public.messages m
     JOIN public.conversations c ON ((c.id = m.conversation_id)))
  WHERE ((m.id = message_journal_entries.message_id) AND ((c.coach_id = auth.uid()) OR (c.member_id = auth.uid()))))) OR public.is_super_admin()));


--
-- Name: message_key_results; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.message_key_results ENABLE ROW LEVEL SECURITY;

--
-- Name: message_key_results message_key_results_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY message_key_results_insert ON public.message_key_results FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM (public.messages m
     JOIN public.conversations c ON ((c.id = m.conversation_id)))
  WHERE ((m.id = message_key_results.message_id) AND (m.sender_id = auth.uid()) AND ((c.coach_id = auth.uid()) OR (c.member_id = auth.uid()))))) OR public.is_super_admin()));


--
-- Name: message_key_results message_key_results_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY message_key_results_select ON public.message_key_results FOR SELECT USING (((EXISTS ( SELECT 1
   FROM (public.messages m
     JOIN public.conversations c ON ((c.id = m.conversation_id)))
  WHERE ((m.id = message_key_results.message_id) AND ((c.coach_id = auth.uid()) OR (c.member_id = auth.uid()))))) OR public.is_super_admin()));


--
-- Name: message_standard_goals; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.message_standard_goals ENABLE ROW LEVEL SECURITY;

--
-- Name: message_standard_goals message_standard_goals_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY message_standard_goals_insert ON public.message_standard_goals FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM (public.messages m
     JOIN public.conversations c ON ((c.id = m.conversation_id)))
  WHERE ((m.id = message_standard_goals.message_id) AND (m.sender_id = auth.uid()) AND ((c.coach_id = auth.uid()) OR (c.member_id = auth.uid()))))) OR public.is_super_admin()));


--
-- Name: message_standard_goals message_standard_goals_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY message_standard_goals_select ON public.message_standard_goals FOR SELECT USING (((EXISTS ( SELECT 1
   FROM (public.messages m
     JOIN public.conversations c ON ((c.id = m.conversation_id)))
  WHERE ((m.id = message_standard_goals.message_id) AND ((c.coach_id = auth.uid()) OR (c.member_id = auth.uid()))))) OR public.is_super_admin()));


--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: messages messages_insert_participant; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY messages_insert_participant ON public.messages FOR INSERT WITH CHECK ((((auth.uid() = sender_id) AND (conversation_id IN ( SELECT c.id
   FROM public.conversations c
  WHERE ((auth.uid() = c.coach_id) OR (auth.uid() = c.member_id) OR ((c.is_group = true) AND (EXISTS ( SELECT 1
           FROM public.client_members cm
          WHERE ((cm.client_id = c.client_id) AND (cm.user_id = auth.uid()))))))))) OR public.is_super_admin()));


--
-- Name: messages messages_select_participant; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY messages_select_participant ON public.messages FOR SELECT USING (((conversation_id IN ( SELECT c.id
   FROM public.conversations c
  WHERE ((auth.uid() = c.coach_id) OR (auth.uid() = c.member_id) OR ((c.is_group = true) AND (EXISTS ( SELECT 1
           FROM public.client_members cm
          WHERE ((cm.client_id = c.client_id) AND (cm.user_id = auth.uid())))))))) OR public.is_super_admin()));


--
-- Name: metric_values; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.metric_values ENABLE ROW LEVEL SECURITY;

--
-- Name: metric_values metric_values_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY metric_values_delete ON public.metric_values FOR DELETE USING ((metric_id IN ( SELECT m.id
   FROM public.metrics m
  WHERE (m.client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)))));


--
-- Name: metric_values metric_values_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY metric_values_insert ON public.metric_values FOR INSERT WITH CHECK ((metric_id IN ( SELECT m.id
   FROM public.metrics m
  WHERE (m.client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)))));


--
-- Name: metric_values metric_values_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY metric_values_select ON public.metric_values FOR SELECT USING ((metric_id IN ( SELECT m.id
   FROM public.metrics m
  WHERE (m.client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)))));


--
-- Name: metric_values metric_values_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY metric_values_update ON public.metric_values FOR UPDATE USING ((metric_id IN ( SELECT m.id
   FROM public.metrics m
  WHERE (m.client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)))));


--
-- Name: metrics; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: metrics metrics_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY metrics_delete ON public.metrics FOR DELETE USING ((client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)));


--
-- Name: metrics metrics_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY metrics_insert ON public.metrics FOR INSERT WITH CHECK ((client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)));


--
-- Name: metrics metrics_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY metrics_select ON public.metrics FOR SELECT USING ((client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)));


--
-- Name: metrics metrics_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY metrics_update ON public.metrics FOR UPDATE USING ((client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: profiles profiles_select_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY profiles_select_authenticated ON public.profiles FOR SELECT TO authenticated USING (true);


--
-- Name: profiles profiles_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: profiles profiles_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: push_tokens; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: push_tokens push_tokens_delete_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY push_tokens_delete_owner ON public.push_tokens FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: push_tokens push_tokens_insert_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY push_tokens_insert_owner ON public.push_tokens FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: push_tokens push_tokens_select_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY push_tokens_select_owner ON public.push_tokens FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: push_tokens push_tokens_update_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY push_tokens_update_owner ON public.push_tokens FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: quarterly_goals; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.quarterly_goals ENABLE ROW LEVEL SECURITY;

--
-- Name: quarterly_goals quarterly_goals_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY quarterly_goals_delete ON public.quarterly_goals FOR DELETE USING ((client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)));


--
-- Name: quarterly_goals quarterly_goals_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY quarterly_goals_insert ON public.quarterly_goals FOR INSERT WITH CHECK ((client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)));


--
-- Name: quarterly_goals quarterly_goals_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY quarterly_goals_select ON public.quarterly_goals FOR SELECT USING ((client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)));


--
-- Name: quarterly_goals quarterly_goals_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY quarterly_goals_update ON public.quarterly_goals FOR UPDATE USING ((client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)));


--
-- Name: quarterly_key_results; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.quarterly_key_results ENABLE ROW LEVEL SECURITY;

--
-- Name: quarterly_key_results quarterly_key_results_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY quarterly_key_results_delete ON public.quarterly_key_results FOR DELETE USING ((quarterly_goal_id IN ( SELECT qg.id
   FROM public.quarterly_goals qg
  WHERE (qg.client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)))));


--
-- Name: quarterly_key_results quarterly_key_results_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY quarterly_key_results_insert ON public.quarterly_key_results FOR INSERT WITH CHECK ((quarterly_goal_id IN ( SELECT qg.id
   FROM public.quarterly_goals qg
  WHERE (qg.client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)))));


--
-- Name: quarterly_key_results quarterly_key_results_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY quarterly_key_results_select ON public.quarterly_key_results FOR SELECT USING ((quarterly_goal_id IN ( SELECT qg.id
   FROM public.quarterly_goals qg
  WHERE (qg.client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)))));


--
-- Name: quarterly_key_results quarterly_key_results_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY quarterly_key_results_update ON public.quarterly_key_results FOR UPDATE USING ((quarterly_goal_id IN ( SELECT qg.id
   FROM public.quarterly_goals qg
  WHERE (qg.client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)))));


--
-- Name: automation_recurring_config recurring_config_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY recurring_config_delete ON public.automation_recurring_config FOR DELETE USING (((EXISTS ( SELECT 1
   FROM public.automations
  WHERE ((automations.id = automation_recurring_config.automation_id) AND (automations.coach_id = auth.uid())))) OR public.is_super_admin()));


--
-- Name: automation_recurring_config recurring_config_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY recurring_config_insert ON public.automation_recurring_config FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM public.automations
  WHERE ((automations.id = automation_recurring_config.automation_id) AND (automations.coach_id = auth.uid())))) OR public.is_super_admin()));


--
-- Name: automation_recurring_config recurring_config_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY recurring_config_select ON public.automation_recurring_config FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.automations
  WHERE ((automations.id = automation_recurring_config.automation_id) AND ((automations.coach_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.client_members
          WHERE ((client_members.client_id = automations.client_id) AND (client_members.user_id = auth.uid()) AND (client_members.role = 'coach'::text)))))))) OR public.is_super_admin()));


--
-- Name: automation_recurring_config recurring_config_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY recurring_config_update ON public.automation_recurring_config FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM public.automations
  WHERE ((automations.id = automation_recurring_config.automation_id) AND (automations.coach_id = auth.uid())))) OR public.is_super_admin()));


--
-- Name: automation_scheduled_config scheduled_config_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY scheduled_config_delete ON public.automation_scheduled_config FOR DELETE USING (((EXISTS ( SELECT 1
   FROM public.automations a
  WHERE ((a.id = automation_scheduled_config.automation_id) AND (a.coach_id = auth.uid())))) OR public.is_super_admin()));


--
-- Name: automation_scheduled_config scheduled_config_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY scheduled_config_insert ON public.automation_scheduled_config FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM public.automations a
  WHERE ((a.id = automation_scheduled_config.automation_id) AND (a.coach_id = auth.uid())))) OR public.is_super_admin()));


--
-- Name: automation_scheduled_config scheduled_config_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY scheduled_config_select ON public.automation_scheduled_config FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.automations a
  WHERE ((a.id = automation_scheduled_config.automation_id) AND (a.coach_id = auth.uid())))) OR public.is_super_admin()));


--
-- Name: automation_scheduled_config scheduled_config_service; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY scheduled_config_service ON public.automation_scheduled_config USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: automation_scheduled_config scheduled_config_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY scheduled_config_update ON public.automation_scheduled_config FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM public.automations a
  WHERE ((a.id = automation_scheduled_config.automation_id) AND (a.coach_id = auth.uid())))) OR public.is_super_admin()));


--
-- Name: standard_goal_values; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.standard_goal_values ENABLE ROW LEVEL SECURITY;

--
-- Name: standard_goal_values standard_goal_values_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY standard_goal_values_delete ON public.standard_goal_values FOR DELETE USING ((standard_goal_id IN ( SELECT standard_goals.id
   FROM public.standard_goals
  WHERE (standard_goals.board_id IN ( SELECT goal_boards.id
           FROM public.goal_boards
          WHERE (goal_boards.client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)))))));


--
-- Name: standard_goal_values standard_goal_values_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY standard_goal_values_insert ON public.standard_goal_values FOR INSERT WITH CHECK ((standard_goal_id IN ( SELECT standard_goals.id
   FROM public.standard_goals
  WHERE (standard_goals.board_id IN ( SELECT goal_boards.id
           FROM public.goal_boards
          WHERE (goal_boards.client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)))))));


--
-- Name: standard_goal_values standard_goal_values_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY standard_goal_values_select ON public.standard_goal_values FOR SELECT USING ((standard_goal_id IN ( SELECT standard_goals.id
   FROM public.standard_goals
  WHERE (standard_goals.board_id IN ( SELECT goal_boards.id
           FROM public.goal_boards
          WHERE (goal_boards.client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)))))));


--
-- Name: standard_goal_values standard_goal_values_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY standard_goal_values_update ON public.standard_goal_values FOR UPDATE USING ((standard_goal_id IN ( SELECT standard_goals.id
   FROM public.standard_goals
  WHERE (standard_goals.board_id IN ( SELECT goal_boards.id
           FROM public.goal_boards
          WHERE (goal_boards.client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)))))));


--
-- Name: standard_goals; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.standard_goals ENABLE ROW LEVEL SECURITY;

--
-- Name: standard_goals standard_goals_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY standard_goals_delete ON public.standard_goals FOR DELETE USING ((board_id IN ( SELECT goal_boards.id
   FROM public.goal_boards
  WHERE (goal_boards.client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)))));


--
-- Name: standard_goals standard_goals_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY standard_goals_insert ON public.standard_goals FOR INSERT WITH CHECK ((board_id IN ( SELECT goal_boards.id
   FROM public.goal_boards
  WHERE (goal_boards.client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)))));


--
-- Name: standard_goals standard_goals_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY standard_goals_select ON public.standard_goals FOR SELECT USING ((board_id IN ( SELECT goal_boards.id
   FROM public.goal_boards
  WHERE (goal_boards.client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)))));


--
-- Name: standard_goals standard_goals_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY standard_goals_update ON public.standard_goals FOR UPDATE USING ((board_id IN ( SELECT goal_boards.id
   FROM public.goal_boards
  WHERE (goal_boards.client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)))));


--
-- Name: weekly_values; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.weekly_values ENABLE ROW LEVEL SECURITY;

--
-- Name: weekly_values weekly_values_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY weekly_values_delete ON public.weekly_values FOR DELETE USING ((quarterly_key_result_id IN ( SELECT qkr.id
   FROM public.quarterly_key_results qkr
  WHERE (qkr.quarterly_goal_id IN ( SELECT qg.id
           FROM public.quarterly_goals qg
          WHERE (qg.client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)))))));


--
-- Name: weekly_values weekly_values_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY weekly_values_insert ON public.weekly_values FOR INSERT WITH CHECK ((quarterly_key_result_id IN ( SELECT qkr.id
   FROM public.quarterly_key_results qkr
  WHERE (qkr.quarterly_goal_id IN ( SELECT qg.id
           FROM public.quarterly_goals qg
          WHERE (qg.client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)))))));


--
-- Name: weekly_values weekly_values_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY weekly_values_select ON public.weekly_values FOR SELECT USING ((quarterly_key_result_id IN ( SELECT qkr.id
   FROM public.quarterly_key_results qkr
  WHERE (qkr.quarterly_goal_id IN ( SELECT qg.id
           FROM public.quarterly_goals qg
          WHERE (qg.client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)))))));


--
-- Name: weekly_values weekly_values_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY weekly_values_update ON public.weekly_values FOR UPDATE USING ((quarterly_key_result_id IN ( SELECT qkr.id
   FROM public.quarterly_key_results qkr
  WHERE (qkr.quarterly_goal_id IN ( SELECT qg.id
           FROM public.quarterly_goals qg
          WHERE (qg.client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)))))));


--
-- Name: yearly_goals; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.yearly_goals ENABLE ROW LEVEL SECURITY;

--
-- Name: yearly_goals yearly_goals_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY yearly_goals_delete ON public.yearly_goals FOR DELETE USING ((client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)));


--
-- Name: yearly_goals yearly_goals_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY yearly_goals_insert ON public.yearly_goals FOR INSERT WITH CHECK ((client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)));


--
-- Name: yearly_goals yearly_goals_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY yearly_goals_select ON public.yearly_goals FOR SELECT USING ((client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)));


--
-- Name: yearly_goals yearly_goals_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY yearly_goals_update ON public.yearly_goals FOR UPDATE USING ((client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)));


--
-- Name: yearly_key_results; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.yearly_key_results ENABLE ROW LEVEL SECURITY;

--
-- Name: yearly_key_results yearly_key_results_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY yearly_key_results_delete ON public.yearly_key_results FOR DELETE USING ((yearly_goal_id IN ( SELECT yg.id
   FROM public.yearly_goals yg
  WHERE (yg.client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)))));


--
-- Name: yearly_key_results yearly_key_results_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY yearly_key_results_insert ON public.yearly_key_results FOR INSERT WITH CHECK ((yearly_goal_id IN ( SELECT yg.id
   FROM public.yearly_goals yg
  WHERE (yg.client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)))));


--
-- Name: yearly_key_results yearly_key_results_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY yearly_key_results_select ON public.yearly_key_results FOR SELECT USING ((yearly_goal_id IN ( SELECT yg.id
   FROM public.yearly_goals yg
  WHERE (yg.client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)))));


--
-- Name: yearly_key_results yearly_key_results_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY yearly_key_results_update ON public.yearly_key_results FOR UPDATE USING ((yearly_goal_id IN ( SELECT yg.id
   FROM public.yearly_goals yg
  WHERE (yg.client_id IN ( SELECT public.get_user_client_ids() AS get_user_client_ids)))));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION execute_automations(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.execute_automations() TO anon;
GRANT ALL ON FUNCTION public.execute_automations() TO authenticated;
GRANT ALL ON FUNCTION public.execute_automations() TO service_role;


--
-- Name: FUNCTION get_client_members_with_email(p_client_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_client_members_with_email(p_client_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_client_members_with_email(p_client_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_client_members_with_email(p_client_id uuid) TO service_role;


--
-- Name: FUNCTION get_user_client_ids(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_user_client_ids() TO anon;
GRANT ALL ON FUNCTION public.get_user_client_ids() TO authenticated;
GRANT ALL ON FUNCTION public.get_user_client_ids() TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION is_super_admin(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_super_admin() TO anon;
GRANT ALL ON FUNCTION public.is_super_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_super_admin() TO service_role;


--
-- Name: FUNCTION set_push_tokens_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_push_tokens_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_push_tokens_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_push_tokens_updated_at() TO service_role;


--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_updated_at_column() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;


--
-- Name: TABLE automation_conversations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.automation_conversations TO anon;
GRANT ALL ON TABLE public.automation_conversations TO authenticated;
GRANT ALL ON TABLE public.automation_conversations TO service_role;


--
-- Name: TABLE automation_execution_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.automation_execution_log TO anon;
GRANT ALL ON TABLE public.automation_execution_log TO authenticated;
GRANT ALL ON TABLE public.automation_execution_log TO service_role;


--
-- Name: TABLE automation_key_results; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.automation_key_results TO anon;
GRANT ALL ON TABLE public.automation_key_results TO authenticated;
GRANT ALL ON TABLE public.automation_key_results TO service_role;


--
-- Name: TABLE automation_meeting_config; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.automation_meeting_config TO anon;
GRANT ALL ON TABLE public.automation_meeting_config TO authenticated;
GRANT ALL ON TABLE public.automation_meeting_config TO service_role;


--
-- Name: TABLE automation_members; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.automation_members TO anon;
GRANT ALL ON TABLE public.automation_members TO authenticated;
GRANT ALL ON TABLE public.automation_members TO service_role;


--
-- Name: TABLE automation_recurring_config; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.automation_recurring_config TO anon;
GRANT ALL ON TABLE public.automation_recurring_config TO authenticated;
GRANT ALL ON TABLE public.automation_recurring_config TO service_role;


--
-- Name: TABLE automation_scheduled_config; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.automation_scheduled_config TO anon;
GRANT ALL ON TABLE public.automation_scheduled_config TO authenticated;
GRANT ALL ON TABLE public.automation_scheduled_config TO service_role;


--
-- Name: TABLE automations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.automations TO anon;
GRANT ALL ON TABLE public.automations TO authenticated;
GRANT ALL ON TABLE public.automations TO service_role;


--
-- Name: TABLE client_members; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.client_members TO anon;
GRANT ALL ON TABLE public.client_members TO authenticated;
GRANT ALL ON TABLE public.client_members TO service_role;


--
-- Name: TABLE clients; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.clients TO anon;
GRANT ALL ON TABLE public.clients TO authenticated;
GRANT ALL ON TABLE public.clients TO service_role;


--
-- Name: TABLE conversations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.conversations TO anon;
GRANT ALL ON TABLE public.conversations TO authenticated;
GRANT ALL ON TABLE public.conversations TO service_role;


--
-- Name: TABLE goal_boards; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.goal_boards TO anon;
GRANT ALL ON TABLE public.goal_boards TO authenticated;
GRANT ALL ON TABLE public.goal_boards TO service_role;


--
-- Name: TABLE google_calendar_connections; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.google_calendar_connections TO anon;
GRANT ALL ON TABLE public.google_calendar_connections TO authenticated;
GRANT ALL ON TABLE public.google_calendar_connections TO service_role;


--
-- Name: TABLE invitations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.invitations TO anon;
GRANT ALL ON TABLE public.invitations TO authenticated;
GRANT ALL ON TABLE public.invitations TO service_role;


--
-- Name: TABLE journal_entries; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.journal_entries TO anon;
GRANT ALL ON TABLE public.journal_entries TO authenticated;
GRANT ALL ON TABLE public.journal_entries TO service_role;


--
-- Name: TABLE journals; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.journals TO anon;
GRANT ALL ON TABLE public.journals TO authenticated;
GRANT ALL ON TABLE public.journals TO service_role;


--
-- Name: TABLE meeting_documents; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.meeting_documents TO anon;
GRANT ALL ON TABLE public.meeting_documents TO authenticated;
GRANT ALL ON TABLE public.meeting_documents TO service_role;


--
-- Name: TABLE meetings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.meetings TO anon;
GRANT ALL ON TABLE public.meetings TO authenticated;
GRANT ALL ON TABLE public.meetings TO service_role;


--
-- Name: TABLE message_journal_entries; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.message_journal_entries TO anon;
GRANT ALL ON TABLE public.message_journal_entries TO authenticated;
GRANT ALL ON TABLE public.message_journal_entries TO service_role;


--
-- Name: TABLE message_key_results; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.message_key_results TO anon;
GRANT ALL ON TABLE public.message_key_results TO authenticated;
GRANT ALL ON TABLE public.message_key_results TO service_role;


--
-- Name: TABLE message_standard_goals; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.message_standard_goals TO anon;
GRANT ALL ON TABLE public.message_standard_goals TO authenticated;
GRANT ALL ON TABLE public.message_standard_goals TO service_role;


--
-- Name: TABLE messages; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.messages TO anon;
GRANT ALL ON TABLE public.messages TO authenticated;
GRANT ALL ON TABLE public.messages TO service_role;


--
-- Name: TABLE metric_values; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.metric_values TO anon;
GRANT ALL ON TABLE public.metric_values TO authenticated;
GRANT ALL ON TABLE public.metric_values TO service_role;


--
-- Name: TABLE metrics; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.metrics TO anon;
GRANT ALL ON TABLE public.metrics TO authenticated;
GRANT ALL ON TABLE public.metrics TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE push_tokens; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.push_tokens TO anon;
GRANT ALL ON TABLE public.push_tokens TO authenticated;
GRANT ALL ON TABLE public.push_tokens TO service_role;


--
-- Name: TABLE quarterly_goals; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.quarterly_goals TO anon;
GRANT ALL ON TABLE public.quarterly_goals TO authenticated;
GRANT ALL ON TABLE public.quarterly_goals TO service_role;


--
-- Name: TABLE quarterly_key_results; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.quarterly_key_results TO anon;
GRANT ALL ON TABLE public.quarterly_key_results TO authenticated;
GRANT ALL ON TABLE public.quarterly_key_results TO service_role;


--
-- Name: TABLE standard_goal_values; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.standard_goal_values TO anon;
GRANT ALL ON TABLE public.standard_goal_values TO authenticated;
GRANT ALL ON TABLE public.standard_goal_values TO service_role;


--
-- Name: TABLE standard_goals; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.standard_goals TO anon;
GRANT ALL ON TABLE public.standard_goals TO authenticated;
GRANT ALL ON TABLE public.standard_goals TO service_role;


--
-- Name: TABLE weekly_values; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.weekly_values TO anon;
GRANT ALL ON TABLE public.weekly_values TO authenticated;
GRANT ALL ON TABLE public.weekly_values TO service_role;


--
-- Name: TABLE yearly_goals; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.yearly_goals TO anon;
GRANT ALL ON TABLE public.yearly_goals TO authenticated;
GRANT ALL ON TABLE public.yearly_goals TO service_role;


--
-- Name: TABLE yearly_key_results; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.yearly_key_results TO anon;
GRANT ALL ON TABLE public.yearly_key_results TO authenticated;
GRANT ALL ON TABLE public.yearly_key_results TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--


