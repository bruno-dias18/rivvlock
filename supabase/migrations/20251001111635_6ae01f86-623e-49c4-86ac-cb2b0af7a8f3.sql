-- Phase 1: Sécurisation Critique - Suppression des vues problématiques et renforcement RLS

-- 1. Supprimer les vues qui ne sont pas utilisées et causent des alertes de sécurité
DROP VIEW IF EXISTS public.transaction_counterparty_profiles CASCADE;
DROP VIEW IF EXISTS public.profiles_safe_view CASCADE;

-- 2. Renforcer la sécurité de la table profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

-- 3. Révoquer tous les accès publics/anonymes sur toutes les tables sensibles
REVOKE ALL ON public.profiles FROM PUBLIC;
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.transactions FROM PUBLIC;
REVOKE ALL ON public.transactions FROM anon;
REVOKE ALL ON public.disputes FROM PUBLIC;
REVOKE ALL ON public.disputes FROM anon;
REVOKE ALL ON public.dispute_messages FROM PUBLIC;
REVOKE ALL ON public.dispute_messages FROM anon;
REVOKE ALL ON public.dispute_proposals FROM PUBLIC;
REVOKE ALL ON public.dispute_proposals FROM anon;
REVOKE ALL ON public.transaction_messages FROM PUBLIC;
REVOKE ALL ON public.transaction_messages FROM anon;
REVOKE ALL ON public.message_reads FROM PUBLIC;
REVOKE ALL ON public.message_reads FROM anon;
REVOKE ALL ON public.invoices FROM PUBLIC;
REVOKE ALL ON public.invoices FROM anon;
REVOKE ALL ON public.stripe_accounts FROM PUBLIC;
REVOKE ALL ON public.stripe_accounts FROM anon;
REVOKE ALL ON public.admin_roles FROM PUBLIC;
REVOKE ALL ON public.admin_roles FROM anon;
REVOKE ALL ON public.activity_logs FROM PUBLIC;
REVOKE ALL ON public.activity_logs FROM anon;
REVOKE ALL ON public.invoice_sequences FROM PUBLIC;
REVOKE ALL ON public.invoice_sequences FROM anon;
REVOKE ALL ON public.profile_access_logs FROM PUBLIC;
REVOKE ALL ON public.profile_access_logs FROM anon;

-- 4. Accorder les permissions nécessaires uniquement aux utilisateurs authentifiés
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disputes TO authenticated;
GRANT SELECT, INSERT ON public.dispute_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.dispute_proposals TO authenticated;
GRANT SELECT, INSERT ON public.transaction_messages TO authenticated;
GRANT SELECT, INSERT ON public.message_reads TO authenticated;
GRANT SELECT, INSERT ON public.invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.stripe_accounts TO authenticated;
GRANT SELECT ON public.admin_roles TO authenticated;
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.invoice_sequences TO authenticated;
GRANT SELECT, INSERT ON public.profile_access_logs TO authenticated;

-- 5. Vérifier que RLS est activé sur toutes les tables sensibles
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_proposals FORCE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads FORCE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices FORCE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_roles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_sequences FORCE ROW LEVEL SECURITY;
ALTER TABLE public.profile_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_access_logs FORCE ROW LEVEL SECURITY;