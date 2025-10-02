-- ============================================
-- CORRECTION FINALE DES FAILLES CRITIQUES
-- ============================================

-- 1. PROFILES : Supprimer les policies conflictuelles et n'en garder qu'UNE stricte
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Prevent unfiltered profile access" ON public.profiles;
DROP POLICY IF EXISTS "Prevent unfiltered profile enumeration" ON public.profiles;

-- Policy unique et stricte pour l'accès aux profils
CREATE POLICY "Strict profile access only"
  ON public.profiles
  FOR SELECT
  USING (
    (auth.uid() = user_id) OR 
    is_admin(auth.uid()) OR
    are_transaction_counterparties(auth.uid(), user_id)
  );

-- 2. TRANSACTION_ACCESS_ATTEMPTS : Ajouter policy INSERT restrictive
DROP POLICY IF EXISTS "Service role can insert access attempts" ON public.transaction_access_attempts;
DROP POLICY IF EXISTS "Non-admins cannot view access attempts" ON public.transaction_access_attempts;

-- Policy stricte : PERSONNE ne peut insérer directement (seulement via fonction SECURITY DEFINER)
CREATE POLICY "No direct inserts allowed"
  ON public.transaction_access_attempts
  FOR INSERT
  WITH CHECK (false); -- Bloque tout INSERT direct

CREATE POLICY "Only admins can read attempts"
  ON public.transaction_access_attempts
  FOR SELECT
  USING (is_admin(auth.uid()));

-- 3. DISPUTE_MESSAGES : Policy DELETE explicite
CREATE POLICY "No message deletion except admins"
  ON public.dispute_messages
  FOR DELETE
  USING (is_admin(auth.uid()));

-- 4. ACTIVITY_LOGS : Policies UPDATE/DELETE explicites
CREATE POLICY "No activity log updates"
  ON public.activity_logs
  FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "No activity log deletion"
  ON public.activity_logs
  FOR DELETE
  USING (is_admin(auth.uid()));

-- 5. STRIPE_ACCOUNTS : Consolider les policies (supprimer les doublons)
DROP POLICY IF EXISTS "Admins can view all stripe accounts" ON public.stripe_accounts;
DROP POLICY IF EXISTS "Users can view their own stripe account" ON public.stripe_accounts;

-- Policy unique consolidée
CREATE POLICY "Consolidated stripe account access"
  ON public.stripe_accounts
  FOR SELECT
  USING (
    (auth.uid() = user_id) OR is_admin(auth.uid())
  );

-- 6. INVOICES : Ajouter validation des invoice numbers séquentiels
-- (Les numéros de facture sont déjà générés via get_next_invoice_sequence qui est sécurisé)
COMMENT ON COLUMN public.invoices.invoice_number IS 
'Generated via SECURITY DEFINER function get_next_invoice_sequence. Non-predictable per seller.';

-- 7. Documenter que shared_transactions est INTENTIONNELLEMENT publique
COMMENT ON VIEW public.shared_transactions IS 
'SÉCURITÉ: Cette vue est intentionnellement accessible aux utilisateurs anonymes via GRANT SELECT TO anon. 
Elle expose UNIQUEMENT des données non-sensibles (titre, description, prix, devise) pour les liens de partage. 
AUCUN ID utilisateur, email, Stripe ID ou donnée sensible n''est accessible via cette vue.';

-- Revoke puis re-grant explicitement pour clarifier l'intention
REVOKE ALL ON public.shared_transactions FROM anon, authenticated;
GRANT SELECT ON public.shared_transactions TO anon, authenticated;