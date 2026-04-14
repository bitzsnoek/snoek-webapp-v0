-- Secure function to get company members with email (replaces insecure view)
-- The old view (company_members_with_email) was dropped and replaced with this
-- SECURITY DEFINER function that includes access-control checks.
DROP VIEW IF EXISTS public.company_members_with_email;

CREATE OR REPLACE FUNCTION public.get_company_members_with_email(p_company_id uuid)
RETURNS TABLE(
  id uuid,
  company_id uuid,
  user_id uuid,
  created_at timestamp with time zone,
  role text,
  name text,
  avatar_url text,
  emails text[],
  role_title text,
  user_email character varying
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM company_members cm
    WHERE cm.company_id = p_company_id AND cm.user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = p_company_id AND c.coach_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: You are not a member of this company';
  END IF;

  RETURN QUERY
  SELECT
    cm.id, cm.company_id, cm.user_id, cm.created_at,
    cm.role, cm.name, cm.avatar_url, cm.emails, cm.role_title,
    au.email as user_email
  FROM company_members cm
  LEFT JOIN auth.users au ON cm.user_id = au.id
  WHERE cm.company_id = p_company_id;
END;
$$;

COMMENT ON FUNCTION public.get_company_members_with_email(p_company_id uuid)
IS 'Securely retrieves company members with their email addresses.
Only accessible to authenticated users who are members of the specified company or the company coach.
This replaces the insecure company_members_with_email view.';
