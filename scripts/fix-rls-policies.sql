-- Security Fix: Enable RLS and add proper policies
-- This script addresses security vulnerabilities in the database

-- ============================================================
-- 1. company_members_with_email — replaced by SECURITY DEFINER function
-- The old view was replaced with get_company_members_with_email(uuid)
-- which enforces access control in the function body (checks company
-- membership or coach ownership) before returning results.
-- See 010_add_members_email_view.sql for the function definition.
-- ============================================================

-- ============================================================
-- 2. Profiles - already has good RLS, just verify enabled
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. Company Members - already has policies, verify they're comprehensive
-- Existing: company_members_select, company_members_insert, 
--           company_members_update, company_members_delete
-- ============================================================

ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. Conversations - strengthen with participant checks
-- Existing: conversations_select, conversations_insert
-- ============================================================

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to replace with stronger ones
DROP POLICY IF EXISTS "conversations_select" ON conversations;
DROP POLICY IF EXISTS "conversations_insert" ON conversations;

-- Users can only view conversations they're part of (coach or founder)
CREATE POLICY "conversations_select_participant" ON conversations
  FOR SELECT USING (
    auth.uid() = coach_id OR auth.uid() = founder_id
  );

-- Coaches can create conversations for their companies
CREATE POLICY "conversations_insert_coach" ON conversations
  FOR INSERT WITH CHECK (
    auth.uid() = coach_id AND
    company_id IN (
      SELECT cm.company_id FROM company_members cm
      WHERE cm.user_id = auth.uid() AND cm.role = 'coach'
    )
  );

-- ============================================================
-- 5. Messages - strengthen with conversation participant checks
-- Existing: messages_select, messages_insert
-- ============================================================

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to replace with stronger ones
DROP POLICY IF EXISTS "messages_select" ON messages;
DROP POLICY IF EXISTS "messages_insert" ON messages;

-- Users can view messages in conversations they're part of
CREATE POLICY "messages_select_participant" ON messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE auth.uid() = coach_id OR auth.uid() = founder_id
    )
  );

-- Users can send messages in conversations they're part of (must be sender)
CREATE POLICY "messages_insert_participant" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    conversation_id IN (
      SELECT id FROM conversations
      WHERE auth.uid() = coach_id OR auth.uid() = founder_id
    )
  );

-- ============================================================
-- 6. Push Tokens - strengthen with owner checks
-- Existing: push_tokens_insert_own, push_tokens_select_own, push_tokens_delete_own
-- ============================================================

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Drop existing policies and recreate with explicit ownership checks
DROP POLICY IF EXISTS "push_tokens_insert_own" ON push_tokens;
DROP POLICY IF EXISTS "push_tokens_select_own" ON push_tokens;
DROP POLICY IF EXISTS "push_tokens_delete_own" ON push_tokens;

-- Users can only manage their own push tokens
CREATE POLICY "push_tokens_select_owner" ON push_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "push_tokens_insert_owner" ON push_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_tokens_update_owner" ON push_tokens
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "push_tokens_delete_owner" ON push_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 7. Meeting Documents - verify company membership
-- Existing: meeting_documents_delete, meeting_documents_select,
--           meeting_documents_insert, meeting_documents_update
-- ============================================================

ALTER TABLE meeting_documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to replace with stronger company-scoped ones
DROP POLICY IF EXISTS "meeting_documents_select" ON meeting_documents;
DROP POLICY IF EXISTS "meeting_documents_insert" ON meeting_documents;
DROP POLICY IF EXISTS "meeting_documents_update" ON meeting_documents;
DROP POLICY IF EXISTS "meeting_documents_delete" ON meeting_documents;

-- Users can view documents for meetings in their companies
CREATE POLICY "meeting_documents_select_company" ON meeting_documents
  FOR SELECT USING (
    meeting_id IN (
      SELECT m.id FROM meetings m
      WHERE m.company_id IN (
        SELECT cm.company_id FROM company_members cm
        WHERE cm.user_id = auth.uid()
      )
    )
  );

-- Users can insert documents for meetings in their companies
CREATE POLICY "meeting_documents_insert_company" ON meeting_documents
  FOR INSERT WITH CHECK (
    meeting_id IN (
      SELECT m.id FROM meetings m
      WHERE m.company_id IN (
        SELECT cm.company_id FROM company_members cm
        WHERE cm.user_id = auth.uid()
      )
    )
  );

-- Users can update documents for meetings in their companies
CREATE POLICY "meeting_documents_update_company" ON meeting_documents
  FOR UPDATE USING (
    meeting_id IN (
      SELECT m.id FROM meetings m
      WHERE m.company_id IN (
        SELECT cm.company_id FROM company_members cm
        WHERE cm.user_id = auth.uid()
      )
    )
  );

-- Users can delete documents for meetings in their companies
CREATE POLICY "meeting_documents_delete_company" ON meeting_documents
  FOR DELETE USING (
    meeting_id IN (
      SELECT m.id FROM meetings m
      WHERE m.company_id IN (
        SELECT cm.company_id FROM company_members cm
        WHERE cm.user_id = auth.uid()
      )
    )
  );

-- ============================================================
-- 8. Automations - already has coach-scoped policies
-- Existing: automations_insert_coach, automations_select_coach,
--           automations_delete_coach, automations_update_coach
-- ============================================================

ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
-- Existing policies are already properly scoped to coaches

-- ============================================================
-- 9. Meetings - verify company membership
-- Existing: meetings_update, meetings_insert, meetings_select, meetings_delete
-- ============================================================

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
-- Existing policies should already scope to company membership

-- ============================================================
-- 10. Invitations - already has good policies
-- ============================================================

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
-- Existing policies handle coach permissions and token-based access
