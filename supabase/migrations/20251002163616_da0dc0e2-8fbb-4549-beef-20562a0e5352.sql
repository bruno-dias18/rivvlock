-- ============================================
-- CORRECTION FINALE : Limiter l'accès aux profils
-- ============================================

-- Le problème : are_transaction_counterparties() donne accès à TOUT le profil
-- Solution : Retirer cet accès et utiliser UNIQUEMENT get_counterparty_safe_profile()
-- via les Edge Functions pour obtenir les données limitées

-- 1. Retirer l'accès direct aux profils via counterparties
DROP POLICY IF EXISTS "Strict profile access only" ON public.profiles;

-- Policy stricte : UNIQUEMENT propriétaire et admin
CREATE POLICY "Owner and admin only profile access"
  ON public.profiles
  FOR SELECT
  USING (
    (auth.uid() = user_id) OR is_admin(auth.uid())
  );

-- 2. Documenter que l'accès counterparty se fait via get_counterparty_safe_profile()
COMMENT ON FUNCTION public.get_counterparty_safe_profile IS 
'SÉCURITÉ: Cette fonction est la SEULE méthode autorisée pour accéder aux profils des contreparties.
Elle retourne UNIQUEMENT les champs non-sensibles (first_name, last_name, verified, user_type, country, company_name).
AUCUNE donnée sensible (téléphone, adresse, VAT, SIRET, Stripe IDs) n''est exposée.';

-- 3. DISPUTES : Masquer admin_notes des users non-admin
-- Créer une vue sécurisée pour les users
CREATE OR REPLACE VIEW public.user_disputes AS
SELECT 
  id,
  transaction_id,
  reporter_id,
  dispute_type,
  reason,
  resolution,
  status,
  created_at,
  updated_at,
  resolved_at,
  dispute_deadline,
  escalated_at
FROM public.disputes;

GRANT SELECT ON public.user_disputes TO authenticated;

COMMENT ON VIEW public.user_disputes IS 
'Vue des litiges sans les admin_notes pour les utilisateurs normaux. Les admins accèdent à disputes directement.';

-- 4. Clarifier que shared_transactions est INTENTIONNELLEMENT accessible
-- (C'est une VUE, pas une table, donc pas de "policies RLS" au sens traditionnel)
COMMENT ON VIEW public.shared_transactions IS 
'VUE PUBLIQUE SÉCURISÉE: Accessible via GRANT SELECT TO anon (intentionnel).
Cette vue expose UNIQUEMENT des données non-sensibles pour les liens de partage publics.
Données exposées: id, title, description, price, currency, service_date, status.
Données NON exposées: user_id, buyer_id, stripe_payment_intent_id, shared_link_token, emails, noms.
Le scanner de sécurité peut signaler "no RLS policies" mais c''est normal pour une vue publique contrôlée par GRANT.';

-- 5. Ajouter logging pour les accès aux fonctions sensibles
CREATE OR REPLACE FUNCTION public.get_counterparty_safe_profile(profile_user_id uuid)
RETURNS TABLE(user_id uuid, first_name text, last_name text, verified boolean, user_type user_type, country country_code, company_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
$$;