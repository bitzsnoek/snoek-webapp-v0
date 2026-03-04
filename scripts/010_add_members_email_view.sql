-- Create a view that joins company_members with auth.users to expose email
-- Uses security_invoker = false so it runs as the owner (postgres),
-- allowing it to read auth.users which the authenticated role cannot access directly.
DROP VIEW IF EXISTS public.company_members_with_email;

CREATE VIEW public.company_members_with_email
WITH (security_invoker = false)
AS
SELECT
  cm.id,
  cm.company_id,
  cm.user_id,
  cm.role,
  cm.name,
  cm.role_title,
  cm.avatar_url,
  cm.created_at,
  au.email AS user_email
FROM public.company_members cm
LEFT JOIN auth.users au ON au.id = cm.user_id;

ALTER VIEW public.company_members_with_email OWNER TO postgres;

-- Grant access to the view
GRANT SELECT ON public.company_members_with_email TO authenticated;
