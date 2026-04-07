-- Fix security issue: company_members_with_email view exposes auth.users data
-- This migration drops the insecure view and replaces it with a secure function approach

-- Step 1: Drop the insecure view
DROP VIEW IF EXISTS public.company_members_with_email;

-- Step 2: Create a security definer function that safely retrieves member data with email
-- This function runs with the privileges of the function owner (postgres) but includes
-- proper authorization checks to ensure users can only see data they're authorized to access
CREATE OR REPLACE FUNCTION public.get_company_members_with_email(p_company_id uuid)
RETURNS TABLE (
  id uuid,
  company_id uuid,
  user_id uuid,
  created_at timestamptz,
  role text,
  name text,
  avatar_url text,
  emails text[],
  role_title text,
  user_email varchar
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the current user is a member of the company or the coach
  IF NOT EXISTS (
    SELECT 1 FROM company_members cm
    WHERE cm.company_id = p_company_id
    AND cm.user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = p_company_id
    AND c.coach_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: You are not a member of this company';
  END IF;

  -- Return the data with email from auth.users
  RETURN QUERY
  SELECT 
    cm.id,
    cm.company_id,
    cm.user_id,
    cm.created_at,
    cm.role,
    cm.name,
    cm.avatar_url,
    cm.emails,
    cm.role_title,
    au.email as user_email
  FROM company_members cm
  LEFT JOIN auth.users au ON cm.user_id = au.id
  WHERE cm.company_id = p_company_id;
END;
$$;

-- Step 3: Grant execute permission to authenticated users only (not anon)
REVOKE ALL ON FUNCTION public.get_company_members_with_email(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_company_members_with_email(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_company_members_with_email(uuid) TO authenticated;

-- Add a comment explaining the security model
COMMENT ON FUNCTION public.get_company_members_with_email(uuid) IS 
'Securely retrieves company members with their email addresses. 
Only accessible to authenticated users who are members of the specified company or the company coach.
This replaces the insecure company_members_with_email view.';
