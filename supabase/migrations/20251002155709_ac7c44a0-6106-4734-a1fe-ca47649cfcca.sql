-- Fix critical security issue: Restrict profile data exposure to transaction counterparties
-- Drop the overly permissive policy that exposes all profile data
DROP POLICY IF EXISTS "Transaction counterparties can view each other's profiles" ON public.profiles;

-- Create a security definer function that returns ONLY safe profile fields for counterparties
-- This prevents exposure of sensitive tax IDs, banking info, and personal contact details
CREATE OR REPLACE FUNCTION public.get_counterparty_safe_profile(profile_user_id uuid)
RETURNS TABLE (
  user_id uuid,
  first_name text,
  last_name text,
  verified boolean,
  user_type user_type,
  country country_code,
  company_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only return limited profile data if the requester is a transaction counterparty
  IF are_transaction_counterparties(auth.uid(), profile_user_id) THEN
    -- Log this access for audit trail
    INSERT INTO public.profile_access_logs (
      accessed_profile_id,
      accessed_by_user_id,
      access_type,
      accessed_fields
    ) VALUES (
      profile_user_id,
      auth.uid(),
      'counterparty_view',
      ARRAY['first_name', 'last_name', 'verified', 'user_type', 'country', 'company_name']
    );
    
    -- Return the safe fields only
    RETURN QUERY
    SELECT 
      p.user_id,
      p.first_name,
      p.last_name,
      p.verified,
      p.user_type,
      p.country,
      p.company_name
    FROM public.profiles p
    WHERE p.user_id = profile_user_id;
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_counterparty_safe_profile(uuid) TO authenticated;

-- Add a comment explaining the security design
COMMENT ON FUNCTION public.get_counterparty_safe_profile IS 
'Returns limited profile information for transaction counterparties. 
ONLY exposes: name, verification status, user type, country, company name.
NEVER exposes: phone, addresses, tax IDs (SIRET, AVS, VAT), banking info, or rates.
All access is logged to profile_access_logs for audit trail.';