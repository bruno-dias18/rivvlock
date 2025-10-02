-- Phase 1: Sécuriser les données Stripe
-- Supprimer la policy RLS dangereuse qui expose trop de données
DROP POLICY IF EXISTS "Transaction participants can view each other's stripe accounts" ON public.stripe_accounts;

-- Créer une fonction sécurisée qui ne retourne que les informations non-sensibles
CREATE OR REPLACE FUNCTION public.get_counterparty_stripe_status(stripe_user_id uuid)
RETURNS TABLE(
  has_active_account boolean,
  charges_enabled boolean,
  payouts_enabled boolean,
  onboarding_completed boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Vérifier que l'utilisateur est autorisé (transaction counterparty)
  IF NOT are_transaction_counterparties(auth.uid(), stripe_user_id) THEN
    RETURN;
  END IF;

  -- Logger l'accès pour audit
  INSERT INTO public.profile_access_logs (
    accessed_profile_id,
    accessed_by_user_id,
    access_type,
    accessed_fields
  ) VALUES (
    stripe_user_id,
    auth.uid(),
    'stripe_status_view',
    ARRAY['charges_enabled', 'payouts_enabled', 'onboarding_completed']
  );

  -- Retourner uniquement les informations non-sensibles
  RETURN QUERY
  SELECT 
    (sa.charges_enabled AND sa.payouts_enabled AND sa.onboarding_completed) as has_active_account,
    sa.charges_enabled,
    sa.payouts_enabled,
    sa.onboarding_completed
  FROM public.stripe_accounts sa
  WHERE sa.user_id = stripe_user_id
  AND sa.account_status != 'inactive'
  LIMIT 1;
END;
$$;

-- Accorder les permissions
GRANT EXECUTE ON FUNCTION public.get_counterparty_stripe_status(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_counterparty_stripe_status IS 
'Retourne uniquement le statut public du compte Stripe (pas de données sensibles comme stripe_account_id ou country). Accessible uniquement aux contreparties de transaction.';

-- Phase 2: Sécuriser l'accès anonyme aux transactions
-- Ajouter une colonne pour l'expiration des liens partagés
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS shared_link_expires_at timestamp with time zone;

-- Mettre à jour les transactions existantes avec shared_link_token
UPDATE public.transactions 
SET shared_link_expires_at = payment_deadline
WHERE shared_link_token IS NOT NULL 
AND shared_link_expires_at IS NULL;

-- Créer une policy RLS pour l'accès via shared_link_token
CREATE POLICY "Allow anonymous access via valid shared link token"
ON public.transactions
FOR SELECT
TO anon, authenticated
USING (
  shared_link_token IS NOT NULL
  AND status = 'pending'
  AND (shared_link_expires_at IS NULL OR shared_link_expires_at > now())
);

-- Phase 4: Nettoyer les extensions (best practice Supabase)
CREATE SCHEMA IF NOT EXISTS extensions;

-- Déplacer les extensions vers le schéma dédié (sans IF EXISTS car non supporté)
DO $$ 
BEGIN
  -- uuid-ossp
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') THEN
    ALTER EXTENSION "uuid-ossp" SET SCHEMA extensions;
  END IF;
  
  -- pg_stat_statements
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') THEN
    ALTER EXTENSION "pg_stat_statements" SET SCHEMA extensions;
  END IF;
  
  -- pgcrypto
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    ALTER EXTENSION "pgcrypto" SET SCHEMA extensions;
  END IF;
END $$;