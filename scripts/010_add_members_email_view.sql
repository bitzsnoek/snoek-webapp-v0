-- Create a view that joins company_members with auth.users to expose email
CREATE OR REPLACE VIEW public.company_members_with_email AS
SELECT
  cm.*,
  au.email AS user_email
FROM public.company_members cm
LEFT JOIN auth.users au ON au.id = cm.user_id;

-- Grant access to the view
GRANT SELECT ON public.company_members_with_email TO authenticated;
GRANT SELECT ON public.company_members_with_email TO anon;

-- Enable RLS on the view (it inherits from the underlying table's policies)
-- Note: Views in Supabase respect the RLS of the underlying tables
