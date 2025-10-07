-- Fix functions that do INSERTs but are incorrectly marked as STABLE
-- They must be VOLATILE since they modify data

-- Fix get_counterparty_safe_profile
DROP FUNCTION IF EXISTS public.get_counterparty_safe_profile(uuid);
CREATE OR REPLACE FUNCTION public.get_counterparty_safe_profile(profile_user_id uuid)
 RETURNS TABLE(user_id uuid, first_name text, last_name text, verified boolean, user_type user_type, country country_code, company_name text)
 LANGUAGE plpgsql
 VOLATILE -- Changed from STABLE to VOLATILE because it inserts into profile_access_logs
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  -- Vérifier que l'utilisateur est une contrepartie de transaction
  IF NOT are_transaction_counterparties(auth.uid(), profile_user_id) THEN
    RETURN;
  END IF;

  -- Logger cet accès pour audit
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

  -- Retourner UNIQUEMENT les champs non-sensibles
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
END;
$function$;

-- Fix get_counterparty_stripe_status
DROP FUNCTION IF EXISTS public.get_counterparty_stripe_status(uuid);
CREATE OR REPLACE FUNCTION public.get_counterparty_stripe_status(stripe_user_id uuid)
 RETURNS TABLE(has_active_account boolean)
 LANGUAGE plpgsql
 VOLATILE -- Changed from STABLE to VOLATILE because it inserts into profile_access_logs
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  v_is_counterparty boolean;
  v_auth_uid uuid;
BEGIN
  v_auth_uid := auth.uid();
  
  -- Vérifier que l'utilisateur est autorisé (transaction counterparty)
  v_is_counterparty := are_transaction_counterparties(v_auth_uid, stripe_user_id);
  
  IF NOT v_is_counterparty THEN
    -- Retourner explicitement false
    RETURN QUERY SELECT false;
    RETURN;
  END IF;

  -- Logger l'accès pour audit (sans détails sensibles)
  INSERT INTO public.profile_access_logs (
    accessed_profile_id,
    accessed_by_user_id,
    access_type,
    accessed_fields
  ) VALUES (
    stripe_user_id,
    v_auth_uid,
    'stripe_status_view',
    ARRAY['has_active_account']
  );

  -- Retourner UNIQUEMENT un booléen indiquant si le compte est actif
  RETURN QUERY
  SELECT 
    (sa.charges_enabled AND sa.payouts_enabled AND sa.onboarding_completed) as has_active_account
  FROM public.stripe_accounts sa
  WHERE sa.user_id = stripe_user_id
  AND sa.account_status != 'inactive'
  LIMIT 1;
  
  -- Si aucun compte trouvé, retourner false
  IF NOT FOUND THEN
    RETURN QUERY SELECT false;
  END IF;
END;
$function$;

-- Fix get_safe_profile  
DROP FUNCTION IF EXISTS public.get_safe_profile(uuid);
CREATE OR REPLACE FUNCTION public.get_safe_profile(profile_user_id uuid)
 RETURNS TABLE(user_id uuid, first_name text, last_name text, verified boolean, user_type user_type, country country_code, company_name text, registration_complete boolean)
 LANGUAGE plpgsql
 VOLATILE -- Changed from STABLE to VOLATILE for consistency
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  IF NOT (auth.uid() = profile_user_id OR is_admin(auth.uid())) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    p.user_id,
    p.first_name,
    p.last_name,
    p.verified,
    p.user_type,
    p.country,
    p.company_name,
    p.registration_complete
  FROM public.profiles p
  WHERE p.user_id = profile_user_id;
END;
$function$;