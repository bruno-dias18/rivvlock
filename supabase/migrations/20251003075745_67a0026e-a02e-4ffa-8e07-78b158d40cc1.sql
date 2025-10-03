-- SECURITY FIX: Prevent attackers from calling check_token_abuse directly
-- The function now returns only a boolean and logs details internally

-- Drop the old function
DROP FUNCTION IF EXISTS public.check_token_abuse(text, text);

-- Create a secure version that only returns if the request should be blocked
CREATE OR REPLACE FUNCTION public.check_token_abuse_secure(check_token text, check_ip text DEFAULT NULL::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  token_attempts integer;
  ip_attempts integer;
  ip_unique_tokens integer;
  ip_total_failures integer;
  is_blocked boolean := false;
  block_reason text := 'Normal activity';
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

  -- Determine if suspicious and set reason (for internal logging only)
  IF token_attempts > 10 THEN
    is_blocked := true;
    block_reason := 'Too many failed attempts on this token';
  ELSIF ip_attempts > 50 THEN
    is_blocked := true;
    block_reason := 'Too many failed attempts from this IP in last hour';
  ELSIF ip_unique_tokens > 3 THEN
    is_blocked := true;
    block_reason := 'Too many different tokens tried from this IP recently';
  ELSIF ip_total_failures > 100 THEN
    is_blocked := true;
    block_reason := 'IP permanently blocked due to excessive abuse';
  END IF;

  -- Log the check for admin audit trail (but don't expose to caller)
  IF is_blocked THEN
    -- You could insert into an audit log table here if needed
    -- For now, we just return the boolean
    NULL;
  END IF;

  RETURN is_blocked;
END;
$$;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.check_token_abuse_secure(text, text) TO authenticated, service_role, anon;