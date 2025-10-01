-- Fix security definer view issue
-- Drop and recreate the view with security_invoker instead of security_definer
DROP VIEW IF EXISTS public.profiles_safe_view;

CREATE VIEW public.profiles_safe_view 
WITH (security_invoker = true) AS
SELECT 
  id,
  user_id,
  first_name,
  last_name,
  company_name,
  user_type,
  country,
  verified,
  created_at,
  updated_at,
  registration_complete
FROM public.profiles;

COMMENT ON VIEW public.profiles_safe_view IS 'Safe view of profiles containing only non-sensitive fields. Uses security_invoker to respect RLS policies of the underlying profiles table.';

-- Grant access to authenticated users
GRANT SELECT ON public.profiles_safe_view TO authenticated;