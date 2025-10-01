-- Create a security definer function to check if users are transaction counterparties
CREATE OR REPLACE FUNCTION public.are_transaction_counterparties(user_a uuid, user_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM transactions t
    WHERE (
      (t.user_id = user_a AND t.buyer_id = user_b) OR
      (t.user_id = user_b AND t.buyer_id = user_a)
    )
  )
$$;

COMMENT ON FUNCTION public.are_transaction_counterparties IS 
'Security definer function to check if two users are transaction counterparties (buyer/seller in same transaction)';

-- Create a new view specifically for transaction counterparty profiles
CREATE OR REPLACE VIEW public.transaction_counterparty_profiles 
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

COMMENT ON VIEW public.transaction_counterparty_profiles IS 
'View showing safe profile fields that transaction counterparties can see. Uses security_invoker to enforce RLS from profiles table.';

-- Grant access to authenticated users
GRANT SELECT ON public.transaction_counterparty_profiles TO authenticated;

-- Add RLS policy to profiles table allowing transaction counterparties to view each other's profiles
CREATE POLICY "Transaction counterparties can view each other's profiles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND 
  are_transaction_counterparties(auth.uid(), user_id)
);

-- Update comment on profiles_safe_view to clarify its purpose
COMMENT ON VIEW public.profiles_safe_view IS 
'Safe view of profiles with non-sensitive fields. Users can view their own profile. Use transaction_counterparty_profiles for viewing counterparty information.';