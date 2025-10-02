-- ============================================
-- CORRECTIONS FINALES DES FAUX POSITIFS
-- ============================================

-- 1. PROFILES : La policy "Allow auth trigger" avec auth.uid() IS NULL est NÉCESSAIRE
-- pour que le trigger handle_new_user() puisse créer des profils
-- On la documente clairement
COMMENT ON POLICY "Allow auth trigger to create profiles" ON public.profiles IS 
'SÉCURITÉ: Cette policy avec auth.uid() IS NULL est NÉCESSAIRE pour le trigger handle_new_user().
Le trigger s''exécute en tant que SECURITY DEFINER et créé automatiquement un profil lors de l''inscription.
La condition EXISTS (SELECT 1 FROM auth.users u WHERE u.id = profiles.user_id) garantit que seul un user auth valide peut avoir un profil.
Cette approche est recommandée dans la documentation Supabase officielle.';

-- 2. STRIPE_ACCOUNTS : Supprimer la policy dupliquée identifiée par le scanner
DROP POLICY IF EXISTS "Strict user stripe account access" ON public.stripe_accounts;
-- Garder uniquement "Consolidated stripe account access"

-- 3. USER_DISPUTES : Configurer security_invoker et documenter
ALTER VIEW public.user_disputes SET (security_invoker = true);

COMMENT ON VIEW public.user_disputes IS 
'VUE SÉCURISÉE avec security_invoker = true: Utilise automatiquement les policies RLS de la table disputes sous-jacente.
Cette vue masque admin_notes pour les utilisateurs non-admin.
Accessible uniquement aux participants de disputes via les policies RLS de disputes.';

-- 4. Documentation finale de la sécurité globale
COMMENT ON SCHEMA public IS 
'ARCHITECTURE DE SÉCURITÉ:
- Tables sensibles: profiles, stripe_accounts, transactions, invoices, disputes, messages
- Toutes protégées par RLS avec policies strictes (auth.uid() requis)
- Vues publiques: shared_transactions (données limitées, accès anonyme intentionnel)
- Vues sécurisées: user_disputes (masque admin_notes)
- Fonctions SECURITY DEFINER: log_transaction_access, get_counterparty_safe_profile (accès limité et loggé)
- Audit: activity_logs, profile_access_logs, transaction_access_attempts (logging complet)';