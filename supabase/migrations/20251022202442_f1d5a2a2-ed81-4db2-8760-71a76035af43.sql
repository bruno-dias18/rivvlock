-- Table pour le rate limiting distribué
CREATE TABLE IF NOT EXISTS public.rate_limit_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  identifier_type TEXT NOT NULL CHECK (identifier_type IN ('ip', 'user')),
  attempt_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Contrainte unique pour éviter les doublons
  UNIQUE(identifier, identifier_type)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier ON public.rate_limit_attempts(identifier, identifier_type);
CREATE INDEX IF NOT EXISTS idx_rate_limit_window ON public.rate_limit_attempts(window_start);

-- RLS: Seul le service_role peut accéder à cette table (pas d'accès public)
ALTER TABLE public.rate_limit_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.rate_limit_attempts
  FOR ALL USING (
    (current_setting('request.jwt.claims'::text, true)::json ->> 'role'::text) = 'service_role'::text
  );

-- Fonction pour nettoyer les anciennes entrées (> 2 heures)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limit_attempts
  WHERE window_start < NOW() - INTERVAL '2 hours';
END;
$$;

-- Commentaire pour documentation
COMMENT ON TABLE public.rate_limit_attempts IS 'Stockage distribué pour rate limiting des edge functions';
COMMENT ON FUNCTION public.cleanup_old_rate_limits IS 'Nettoie les tentatives de rate limiting de plus de 2 heures (à appeler via cron)';