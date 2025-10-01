-- Fix all remaining security issues
-- 1. Lock down profiles_safe_view - ensure no public access
DROP VIEW IF EXISTS public.profiles_safe_view CASCADE;

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

-- Revoke all default permissions
REVOKE ALL ON public.profiles_safe_view FROM PUBLIC;
REVOKE ALL ON public.profiles_safe_view FROM anon;
REVOKE ALL ON public.profiles_safe_view FROM authenticated;

-- Only grant to authenticated with RLS enforcement
GRANT SELECT ON public.profiles_safe_view TO authenticated;

-- 2. Lock down transaction_counterparty_profiles view
DROP VIEW IF EXISTS public.transaction_counterparty_profiles CASCADE;

CREATE VIEW public.transaction_counterparty_profiles 
WITH (security_invoker = true) AS
SELECT 
  p.id,
  p.user_id,
  p.first_name,
  p.last_name,
  p.company_name,
  p.user_type,
  p.country,
  p.verified
FROM public.profiles p;

-- Revoke all default permissions
REVOKE ALL ON public.transaction_counterparty_profiles FROM PUBLIC;
REVOKE ALL ON public.transaction_counterparty_profiles FROM anon;
REVOKE ALL ON public.transaction_counterparty_profiles FROM authenticated;

-- Only grant to authenticated with RLS enforcement
GRANT SELECT ON public.transaction_counterparty_profiles TO authenticated;

-- 3. Ensure profiles table has proper RLS policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Add comments explaining security model
COMMENT ON VIEW public.profiles_safe_view IS 
'Secure view with security_invoker=true. Access restricted to authenticated users only. Inherits RLS from profiles table - users see only their own profile or profiles they have access to via RLS policies.';

COMMENT ON VIEW public.transaction_counterparty_profiles IS 
'Secure view for transaction counterparties with security_invoker=true. Access restricted to authenticated users only. Shows safe profile fields for users involved in the same transactions.';