-- Re-apply hardened RLS without IF NOT EXISTS

-- 0) Force RLS on sensitive tables (idempotent)
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.invoices FORCE ROW LEVEL SECURITY;
ALTER TABLE public.transactions FORCE ROW LEVEL SECURITY;

-- 1) Ensure explicit authenticated SELECT policies exist (drop then create)
DROP POLICY IF EXISTS "Authenticated can view own profile or admins" ON public.profiles;
CREATE POLICY "Authenticated can view own profile or admins"
ON public.profiles
FOR SELECT
TO authenticated
USING ((auth.uid() = user_id) OR is_admin_secure(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can view own stripe account or admins" ON public.stripe_accounts;
CREATE POLICY "Authenticated can view own stripe account or admins"
ON public.stripe_accounts
FOR SELECT
TO authenticated
USING ((auth.uid() = user_id) OR is_admin_secure(auth.uid()));

DROP POLICY IF EXISTS "Authenticated participants can view transactions" ON public.transactions;
CREATE POLICY "Authenticated participants can view transactions"
ON public.transactions
FOR SELECT
TO authenticated
USING ((user_id = auth.uid()) OR (buyer_id = auth.uid()) OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated participants can view invoices" ON public.invoices;
CREATE POLICY "Authenticated participants can view invoices"
ON public.invoices
FOR SELECT
TO authenticated
USING ((((auth.uid() = seller_id) AND seller_id IS NOT NULL) OR ((auth.uid() = buyer_id) AND buyer_id IS NOT NULL)) OR is_admin(auth.uid()));

-- 2) Token hardening trigger on transactions (idempotent)
DROP TRIGGER IF EXISTS trg_secure_shared_link_token ON public.transactions;
CREATE TRIGGER trg_secure_shared_link_token
BEFORE INSERT OR UPDATE OF shared_link_token, shared_link_expires_at ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.secure_shared_link_token();