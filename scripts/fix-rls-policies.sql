-- Security Fix: Enable RLS and add proper policies
-- This script addresses security vulnerabilities in the database

-- ============================================================
-- 1. Fix company_members_with_email view
-- The view currently has RLS disabled, exposing user emails
-- ============================================================

-- Drop and recreate the view with security definer to use invoker's permissions
DROP VIEW IF EXISTS company_members_with_email;

-- Create a secure version that only shows members from companies the user belongs to
CREATE VIEW company_members_with_email 
WITH (security_invoker = true)
AS
SELECT 
  cm.id,
  cm.company_id,
  cm.user_id,
  cm.name,
  cm.role,
  cm.emails,
  cm.created_at,
  p.email as user_email,
  p.full_name as user_full_name
FROM company_members cm
LEFT JOIN auth.users au ON cm.user_id = au.id
LEFT JOIN profiles p ON cm.user_id = p.id;

-- Grant select on the view to authenticated users
GRANT SELECT ON company_members_with_email TO authenticated;

-- ============================================================
-- 2. Ensure RLS is enabled on all sensitive tables
-- ============================================================

-- Profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles of company members" ON profiles;

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can view profiles of people in their companies
CREATE POLICY "Users can view profiles of company members" ON profiles
  FOR SELECT USING (
    id IN (
      SELECT cm2.user_id FROM company_members cm2
      WHERE cm2.company_id IN (
        SELECT cm1.company_id FROM company_members cm1
        WHERE cm1.user_id = auth.uid()
      )
    )
  );

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- ============================================================
-- 3. Strengthen company_members policies
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view members of their companies" ON company_members;
DROP POLICY IF EXISTS "Coaches can manage company members" ON company_members;
DROP POLICY IF EXISTS "Users can view their own membership" ON company_members;

-- Users can view members of companies they belong to
CREATE POLICY "Users can view members of their companies" ON company_members
  FOR SELECT USING (
    company_id IN (
      SELECT cm.company_id FROM company_members cm
      WHERE cm.user_id = auth.uid()
    )
  );

-- Coaches can insert new members
CREATE POLICY "Coaches can insert company members" ON company_members
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT cm.company_id FROM company_members cm
      WHERE cm.user_id = auth.uid() AND cm.role = 'coach'
    )
  );

-- Coaches can update members in their companies
CREATE POLICY "Coaches can update company members" ON company_members
  FOR UPDATE USING (
    company_id IN (
      SELECT cm.company_id FROM company_members cm
      WHERE cm.user_id = auth.uid() AND cm.role = 'coach'
    )
  );

-- Coaches can delete members in their companies
CREATE POLICY "Coaches can delete company members" ON company_members
  FOR DELETE USING (
    company_id IN (
      SELECT cm.company_id FROM company_members cm
      WHERE cm.user_id = auth.uid() AND cm.role = 'coach'
    )
  );

-- ============================================================
-- 4. Strengthen conversations policies
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their conversations" ON conversations;
DROP POLICY IF EXISTS "Coaches can create conversations" ON conversations;

-- Users can only view conversations they're part of
CREATE POLICY "Users can view their conversations" ON conversations
  FOR SELECT USING (
    auth.uid() = coach_id OR auth.uid() = founder_id
  );

-- Coaches can create conversations
CREATE POLICY "Coaches can create conversations" ON conversations
  FOR INSERT WITH CHECK (
    auth.uid() = coach_id AND
    company_id IN (
      SELECT cm.company_id FROM company_members cm
      WHERE cm.user_id = auth.uid() AND cm.role = 'coach'
    )
  );

-- ============================================================
-- 5. Strengthen messages policies
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can send messages in their conversations" ON messages;

-- Users can view messages in conversations they're part of
CREATE POLICY "Users can view messages in their conversations" ON messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE auth.uid() = coach_id OR auth.uid() = founder_id
    )
  );

-- Users can send messages in conversations they're part of
CREATE POLICY "Users can send messages in their conversations" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    conversation_id IN (
      SELECT id FROM conversations
      WHERE auth.uid() = coach_id OR auth.uid() = founder_id
    )
  );

-- ============================================================
-- 6. Strengthen push_tokens policies
-- ============================================================

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage their own push tokens" ON push_tokens;

-- Users can only view their own push tokens
CREATE POLICY "Users can view own push tokens" ON push_tokens
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own push tokens
CREATE POLICY "Users can insert own push tokens" ON push_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own push tokens
CREATE POLICY "Users can update own push tokens" ON push_tokens
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own push tokens
CREATE POLICY "Users can delete own push tokens" ON push_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 7. Ensure meeting_documents has proper RLS
-- ============================================================

ALTER TABLE meeting_documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view meeting documents" ON meeting_documents;
DROP POLICY IF EXISTS "Users can manage meeting documents" ON meeting_documents;

-- Users can view documents for meetings in their companies
CREATE POLICY "Users can view meeting documents" ON meeting_documents
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
CREATE POLICY "Users can insert meeting documents" ON meeting_documents
  FOR INSERT WITH CHECK (
    meeting_id IN (
      SELECT m.id FROM meetings m
      WHERE m.company_id IN (
        SELECT cm.company_id FROM company_members cm
        WHERE cm.user_id = auth.uid()
      )
    )
  );

-- Users can delete documents for meetings in their companies
CREATE POLICY "Users can delete meeting documents" ON meeting_documents
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
-- 8. Ensure automations has proper RLS
-- ============================================================

ALTER TABLE automations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Coaches can view their automations" ON automations;
DROP POLICY IF EXISTS "Coaches can manage their automations" ON automations;

-- Coaches can view automations for their companies
CREATE POLICY "Coaches can view automations" ON automations
  FOR SELECT USING (
    company_id IN (
      SELECT cm.company_id FROM company_members cm
      WHERE cm.user_id = auth.uid() AND cm.role = 'coach'
    )
  );

-- Coaches can manage automations for their companies
CREATE POLICY "Coaches can insert automations" ON automations
  FOR INSERT WITH CHECK (
    auth.uid() = coach_id AND
    company_id IN (
      SELECT cm.company_id FROM company_members cm
      WHERE cm.user_id = auth.uid() AND cm.role = 'coach'
    )
  );

CREATE POLICY "Coaches can update automations" ON automations
  FOR UPDATE USING (
    company_id IN (
      SELECT cm.company_id FROM company_members cm
      WHERE cm.user_id = auth.uid() AND cm.role = 'coach'
    )
  );

CREATE POLICY "Coaches can delete automations" ON automations
  FOR DELETE USING (
    company_id IN (
      SELECT cm.company_id FROM company_members cm
      WHERE cm.user_id = auth.uid() AND cm.role = 'coach'
    )
  );
