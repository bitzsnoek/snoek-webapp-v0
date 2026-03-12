-- Add is_group column to conversations table to support group chats
-- When is_group is true, founder_id can be null (group chat includes everyone)

-- Make founder_id nullable for group conversations
ALTER TABLE conversations ALTER COLUMN founder_id DROP NOT NULL;

-- Add is_group column with default false
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_group boolean DEFAULT false;

-- Add a name column for group chats (will store company name or custom name)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS name text;

-- Update RLS policies to allow all company members to access group conversations
-- First, drop existing policies
DROP POLICY IF EXISTS "conversations_select" ON conversations;
DROP POLICY IF EXISTS "conversations_insert" ON conversations;

-- Create new select policy that allows:
-- 1. Coaches to see all conversations for their companies
-- 2. Founders to see their own 1-on-1 conversations
-- 3. All company members to see group conversations
CREATE POLICY "conversations_select" ON conversations
  FOR SELECT USING (
    -- Coach can see all conversations for companies they coach
    coach_id = auth.uid()
    OR
    -- Founder can see their own 1-on-1 conversations
    founder_id = auth.uid()
    OR
    -- Any company member can see group conversations
    (is_group = true AND EXISTS (
      SELECT 1 FROM company_members 
      WHERE company_members.company_id = conversations.company_id 
      AND company_members.user_id = auth.uid()
    ))
  );

-- Create new insert policy
CREATE POLICY "conversations_insert" ON conversations
  FOR INSERT WITH CHECK (
    -- Coach can create conversations for their companies
    coach_id = auth.uid()
    OR
    -- Any company member can create group conversations
    (is_group = true AND EXISTS (
      SELECT 1 FROM company_members 
      WHERE company_members.company_id = conversations.company_id 
      AND company_members.user_id = auth.uid()
    ))
  );

-- Update messages policies to allow group chat participants to see/send messages
DROP POLICY IF EXISTS "messages_select" ON messages;
DROP POLICY IF EXISTS "messages_insert" ON messages;

-- Select: can see messages if you're part of the conversation
CREATE POLICY "messages_select" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (
        c.coach_id = auth.uid()
        OR c.founder_id = auth.uid()
        OR (c.is_group = true AND EXISTS (
          SELECT 1 FROM company_members 
          WHERE company_members.company_id = c.company_id 
          AND company_members.user_id = auth.uid()
        ))
      )
    )
  );

-- Insert: can send messages if you're part of the conversation
CREATE POLICY "messages_insert" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (
        c.coach_id = auth.uid()
        OR c.founder_id = auth.uid()
        OR (c.is_group = true AND EXISTS (
          SELECT 1 FROM company_members 
          WHERE company_members.company_id = c.company_id 
          AND company_members.user_id = auth.uid()
        ))
      )
    )
  );
