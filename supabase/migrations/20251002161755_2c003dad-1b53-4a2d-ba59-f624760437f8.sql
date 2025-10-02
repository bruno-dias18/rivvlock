-- ============================================
-- PHASE 1: Secure View for Anonymous Access
-- ============================================

-- Drop the overly permissive policy on transactions
DROP POLICY IF EXISTS "Allow anonymous access via valid shared link token" ON public.transactions;

-- Create a secure view that only exposes non-sensitive transaction data
CREATE OR REPLACE VIEW public.shared_transactions AS
SELECT 
  id,
  title,
  description,
  price,
  currency,
  service_date,
  service_end_date,
  status
FROM public.transactions
WHERE shared_link_token IS NOT NULL
  AND status = 'pending'
  AND (shared_link_expires_at IS NULL OR shared_link_expires_at > now());

-- Grant anonymous access to the view
GRANT SELECT ON public.shared_transactions TO anon;

-- Enable security barrier on the view (prevents side-channel attacks)
ALTER VIEW public.shared_transactions SET (security_barrier = true);

-- ============================================
-- PHASE 2: Secure Audit Logs
-- ============================================

-- Drop the permissive policy
DROP POLICY IF EXISTS "Service role can insert access attempts" ON public.transaction_access_attempts;

-- Create a SECURITY DEFINER function for logging access attempts
CREATE OR REPLACE FUNCTION public.log_transaction_access(
  p_token text,
  p_transaction_id uuid,
  p_success boolean,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_error_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO public.transaction_access_attempts (
    token,
    transaction_id,
    success,
    ip_address,
    user_agent,
    error_reason
  ) VALUES (
    p_token,
    p_transaction_id,
    p_success,
    p_ip_address,
    p_user_agent,
    p_error_reason
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- Create a strict RLS policy for audit logs (read-only for admins)
CREATE POLICY "Only admins can view access attempts"
  ON public.transaction_access_attempts
  FOR SELECT
  USING (is_admin(auth.uid()));

-- ============================================
-- PHASE 3: Restrict Admin Profile Access
-- ============================================

-- Function already exists: public.can_access_full_profile(profile_user_id uuid)
-- Let's make sure it's properly defined
CREATE OR REPLACE FUNCTION public.can_access_full_profile(profile_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT (auth.uid() = profile_user_id) OR is_admin(auth.uid());
$$;

-- Update the admin policy on profiles to be more explicit
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

CREATE POLICY "Admins can update all profiles with logging"
  ON public.profiles
  FOR UPDATE
  USING (can_access_full_profile(user_id))
  WITH CHECK (can_access_full_profile(user_id));

-- ============================================
-- PHASE 4: Enhanced Rate Limiting
-- ============================================

-- Create composite indexes for performance
CREATE INDEX IF NOT EXISTS idx_transaction_access_attempts_ip_time 
  ON public.transaction_access_attempts(ip_address, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transaction_access_attempts_token_time 
  ON public.transaction_access_attempts(token, created_at DESC);

-- Enhanced abuse detection function
CREATE OR REPLACE FUNCTION public.check_token_abuse(check_token text, check_ip text DEFAULT NULL)
RETURNS TABLE(is_suspicious boolean, attempts_last_hour integer, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  token_attempts integer;
  ip_attempts integer;
  ip_unique_tokens integer;
  ip_total_failures integer;
BEGIN
  -- Count failed attempts on this token in the last hour
  SELECT COUNT(*) INTO token_attempts
  FROM public.transaction_access_attempts
  WHERE token = check_token
    AND success = false
    AND created_at > now() - interval '1 hour';

  IF check_ip IS NOT NULL THEN
    -- Count failed attempts from this IP in the last hour
    SELECT COUNT(*) INTO ip_attempts
    FROM public.transaction_access_attempts
    WHERE ip_address = check_ip
      AND success = false
      AND created_at > now() - interval '1 hour';

    -- Count unique tokens tried by this IP in the last 5 minutes
    SELECT COUNT(DISTINCT token) INTO ip_unique_tokens
    FROM public.transaction_access_attempts
    WHERE ip_address = check_ip
      AND created_at > now() - interval '5 minutes';

    -- Count total failures from this IP (all time)
    SELECT COUNT(*) INTO ip_total_failures
    FROM public.transaction_access_attempts
    WHERE ip_address = check_ip
      AND success = false;
  ELSE
    ip_attempts := 0;
    ip_unique_tokens := 0;
    ip_total_failures := 0;
  END IF;

  -- Determine if suspicious with enhanced rules
  IF token_attempts > 10 THEN
    RETURN QUERY SELECT true, token_attempts, 'Too many failed attempts on this token'::text;
  ELSIF ip_attempts > 50 THEN
    RETURN QUERY SELECT true, ip_attempts, 'Too many failed attempts from this IP in last hour'::text;
  ELSIF ip_unique_tokens > 3 THEN
    RETURN QUERY SELECT true, ip_unique_tokens, 'Too many different tokens tried from this IP recently'::text;
  ELSIF ip_total_failures > 100 THEN
    RETURN QUERY SELECT true, ip_total_failures, 'IP permanently blocked due to excessive abuse'::text;
  ELSE
    RETURN QUERY SELECT false, token_attempts, 'Normal activity'::text;
  END IF;
END;
$$;

-- Grant execute permissions on the new functions
GRANT EXECUTE ON FUNCTION public.log_transaction_access TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_token_abuse TO anon, authenticated, service_role;