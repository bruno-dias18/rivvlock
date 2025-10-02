-- Créer une table pour logger les tentatives d'accès aux transactions via token
CREATE TABLE IF NOT EXISTS public.transaction_access_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL,
  ip_address text,
  user_agent text,
  success boolean NOT NULL,
  transaction_id uuid,
  error_reason text,
  created_at timestamp with time zone DEFAULT now()
);

-- Index pour détecter les abus
CREATE INDEX IF NOT EXISTS idx_access_attempts_token_time 
  ON public.transaction_access_attempts(token, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_access_attempts_ip_time 
  ON public.transaction_access_attempts(ip_address, created_at DESC);

-- RLS pour la table d'audit (admin seulement pour consulter)
ALTER TABLE public.transaction_access_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all access attempts"
ON public.transaction_access_attempts
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- Allow the function to insert access logs (using service role)
CREATE POLICY "Service role can insert access attempts"
ON public.transaction_access_attempts
FOR INSERT
TO service_role
WITH CHECK (true);

-- Fonction pour vérifier les tentatives abusives (détection de brute-force)
CREATE OR REPLACE FUNCTION public.check_token_abuse(check_token text, check_ip text DEFAULT NULL)
RETURNS TABLE(
  is_suspicious boolean,
  attempts_last_hour integer,
  reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  token_attempts integer;
  ip_attempts integer;
BEGIN
  -- Compter les tentatives échouées sur ce token dans la dernière heure
  SELECT COUNT(*) INTO token_attempts
  FROM public.transaction_access_attempts
  WHERE token = check_token
    AND success = false
    AND created_at > now() - interval '1 hour';

  -- Si une IP est fournie, compter ses tentatives échouées
  IF check_ip IS NOT NULL THEN
    SELECT COUNT(*) INTO ip_attempts
    FROM public.transaction_access_attempts
    WHERE ip_address = check_ip
      AND success = false
      AND created_at > now() - interval '1 hour';
  ELSE
    ip_attempts := 0;
  END IF;

  -- Déterminer si c'est suspect (rate limiting)
  IF token_attempts > 10 THEN
    RETURN QUERY SELECT true, token_attempts, 'Too many failed attempts on this token'::text;
  ELSIF ip_attempts > 50 THEN
    RETURN QUERY SELECT true, ip_attempts, 'Too many failed attempts from this IP'::text;
  ELSE
    RETURN QUERY SELECT false, token_attempts, 'Normal activity'::text;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_token_abuse(text, text) TO anon, authenticated;

COMMENT ON TABLE public.transaction_access_attempts IS 
'Logs all attempts to access transactions via shared links to detect and prevent brute-force attacks';

COMMENT ON FUNCTION public.check_token_abuse IS 
'Checks if there are suspicious access patterns for a given token or IP address. Returns is_suspicious=true if rate limits are exceeded.';