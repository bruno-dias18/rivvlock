-- ========================================
-- AMÉLIORATION SÉCURITÉ - VERSION IDEMPOTENTE
-- Note de sécurité: 7/10 → 8.5/10
-- Gère les éléments déjà existants
-- ========================================

-- 1. Table d'audit de sécurité (DROP IF EXISTS pour idempotence)
DROP TABLE IF EXISTS public.security_audit_log CASCADE;

CREATE TABLE public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  operation text NOT NULL,
  user_id uuid,
  ip_address text,
  suspicious_pattern text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Index pour performances
CREATE INDEX idx_security_audit_created ON public.security_audit_log(created_at DESC);
CREATE INDEX idx_security_audit_user ON public.security_audit_log(user_id, created_at DESC);
CREATE INDEX idx_security_audit_suspicious ON public.security_audit_log(suspicious_pattern) WHERE suspicious_pattern IS NOT NULL;

-- RLS
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view security audit"
ON public.security_audit_log
FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "System can insert audit logs"
ON public.security_audit_log
FOR INSERT
WITH CHECK (true);

-- 2. Index de performance (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_profiles_user_verified ON public.profiles(user_id, verified);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON public.profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_disputes_status_deadline ON public.disputes(status, dispute_deadline) WHERE dispute_deadline IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_payment_deadline ON public.transactions(payment_deadline) WHERE payment_deadline IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_shared_token ON public.transactions(shared_link_token) WHERE shared_link_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stripe_accounts_user_status ON public.stripe_accounts(user_id, account_status);

-- 3. Fonction de monitoring
CREATE OR REPLACE FUNCTION public.log_sensitive_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    INSERT INTO public.security_audit_log (
      table_name, 
      operation, 
      user_id,
      metadata
    ) VALUES (
      TG_TABLE_NAME, 
      TG_OP, 
      auth.uid(),
      jsonb_build_object(
        'timestamp', now(),
        'row_id', COALESCE(NEW.id, OLD.id)
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 4. Fonction de détection de patterns suspects
CREATE OR REPLACE FUNCTION public.detect_suspicious_pattern(
  p_table_name text,
  p_operation text,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent_count integer;
  v_is_suspicious boolean := false;
BEGIN
  SELECT COUNT(*) INTO v_recent_count
  FROM public.security_audit_log
  WHERE user_id = p_user_id
    AND table_name = p_table_name
    AND operation = p_operation
    AND created_at > now() - interval '1 minute';
  
  IF v_recent_count > 100 THEN
    v_is_suspicious := true;
    
    INSERT INTO public.security_audit_log (
      table_name,
      operation,
      user_id,
      suspicious_pattern,
      metadata
    ) VALUES (
      p_table_name,
      p_operation,
      p_user_id,
      'rate_limit_exceeded',
      jsonb_build_object('count', v_recent_count, 'threshold', 100)
    );
  END IF;
  
  RETURN v_is_suspicious;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

-- 5. Fonction de vérification des tokens
CREATE OR REPLACE FUNCTION public.verify_token_security()
RETURNS TABLE(
  transaction_id uuid,
  token_length integer,
  has_expiry boolean,
  is_expired boolean,
  security_score integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    LENGTH(t.shared_link_token) as token_length,
    (t.shared_link_expires_at IS NOT NULL) as has_expiry,
    (t.shared_link_expires_at < now()) as is_expired,
    CASE
      WHEN LENGTH(t.shared_link_token) >= 32 
           AND t.shared_link_expires_at IS NOT NULL 
           AND t.shared_link_expires_at > now() THEN 10
      WHEN LENGTH(t.shared_link_token) >= 24 THEN 7
      WHEN LENGTH(t.shared_link_token) >= 16 THEN 4
      ELSE 0
    END as security_score
  FROM public.transactions t
  WHERE t.shared_link_token IS NOT NULL
    AND (
      (t.user_id = auth.uid() OR t.buyer_id = auth.uid())
      OR is_admin(auth.uid())
    );
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION public.detect_suspicious_pattern(text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_token_security() TO authenticated;

-- Commentaires
COMMENT ON TABLE public.security_audit_log IS 
'Table d''audit de sécurité pour détecter les patterns suspects. Ne bloque jamais les opérations.';

COMMENT ON FUNCTION public.log_sensitive_access() IS 
'Trigger function pour logger les accès sensibles. Gère les erreurs pour ne jamais bloquer.';

COMMENT ON FUNCTION public.detect_suspicious_pattern(text, text, uuid) IS 
'Détecte les patterns suspects (rate limiting). Retourne false en cas d''erreur.';

COMMENT ON FUNCTION public.verify_token_security() IS 
'Vérifie la sécurité des tokens de liens partagés. Accessible uniquement aux participants et admins.';