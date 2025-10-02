-- ============================================
-- CORRECTION FINALE DES VULNÉRABILITÉS RÉELLES
-- ============================================

-- 1. STRIPE_ACCOUNTS : Supprimer la policy dupliquée (CRITIQUE)
DROP POLICY IF EXISTS "Strict user stripe account access" ON public.stripe_accounts;

-- 2. DISPUTE_MESSAGES : Renforcer la policy avec validation explicite des messages broadcast admin
DROP POLICY IF EXISTS "Strict dispute message access" ON public.dispute_messages;

CREATE POLICY "Strict dispute message access v2" ON public.dispute_messages
FOR SELECT USING (
  -- Messages directs entre participants
  (sender_id = auth.uid() OR recipient_id = auth.uid())
  OR
  -- Messages broadcast admin (recipient_id NULL) uniquement dans SES disputes
  (
    recipient_id IS NULL 
    AND EXISTS (
      SELECT 1 FROM disputes d
      JOIN transactions t ON d.transaction_id = t.id
      WHERE d.id = dispute_messages.dispute_id
      AND (d.reporter_id = auth.uid() OR t.user_id = auth.uid() OR t.buyer_id = auth.uid())
    )
  )
  OR
  -- Admins voient tout
  is_admin(auth.uid())
);

-- 3. DOCUMENTATION : Expliquer pourquoi les "doublons" apparents ne sont PAS des conflits
COMMENT ON POLICY "Strict transaction participant access" ON public.transactions IS 
'SÉCURITÉ: Cette policy est complémentaire avec "Admins can view all transactions".
PostgreSQL évalue les policies SELECT avec OR logic - un user doit matcher AU MOINS UNE policy.
Ici: (participant) OR (admin). Pas de conflit, juste 2 chemins d''accès légitimes.';

COMMENT ON POLICY "Owner and admin only profile access" ON public.profiles IS
'SÉCURITÉ: Les admins ont accès pour support client et modération.
Les données sensibles des contreparties sont accessibles UNIQUEMENT via get_counterparty_safe_profile()
qui LOG tous les accès et retourne UNIQUEMENT les champs non-sensibles (pas de phone, email, etc).';

-- 4. VÉRIFICATION FINALE : Query de diagnostic pour confirmer qu'il n'y a plus de doublons
-- Cette query sera utile pour les audits futurs
COMMENT ON SCHEMA public IS 
'SÉCURITÉ: Pour vérifier les policies RLS, utiliser:
SELECT schemaname, tablename, policyname, cmd FROM pg_policies WHERE schemaname = ''public'' ORDER BY tablename, cmd, policyname;

ARCHITECTURE:
- RLS activé sur toutes les tables sensibles
- Policies strictes avec auth.uid() requis
- Fonctions SECURITY DEFINER pour accès contrôlé et loggé
- Audit complet via activity_logs, profile_access_logs, transaction_access_attempts';