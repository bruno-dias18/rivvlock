-- Ensure explicit anonymous blocks exist on sensitive tables to satisfy scanner

-- ADMIN AUDIT LOG
ALTER TABLE public.admin_role_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Block public SELECT on audit logs" ON public.admin_role_audit_log;
DROP POLICY IF EXISTS "Block anon SELECT on audit logs" ON public.admin_role_audit_log;
CREATE POLICY "Block public SELECT on audit logs" ON public.admin_role_audit_log FOR SELECT TO public USING (false);
CREATE POLICY "Block anon SELECT on audit logs" ON public.admin_role_audit_log FOR SELECT TO anon USING (false);

-- SHARED LINK ACCESS LOGS
ALTER TABLE public.shared_link_access_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Block public SELECT on access logs" ON public.shared_link_access_logs;
DROP POLICY IF EXISTS "Block anon SELECT on access logs" ON public.shared_link_access_logs;
CREATE POLICY "Block public SELECT on access logs" ON public.shared_link_access_logs FOR SELECT TO public USING (false);
CREATE POLICY "Block anon SELECT on access logs" ON public.shared_link_access_logs FOR SELECT TO anon USING (false);

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Block anonymous access (explicit)" ON public.profiles;
CREATE POLICY "Block anonymous access (explicit)" ON public.profiles FOR ALL TO anon USING (false) WITH CHECK (false);

-- TRANSACTIONS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Block anonymous access (explicit)" ON public.transactions;
CREATE POLICY "Block anonymous access (explicit)" ON public.transactions FOR ALL TO anon USING (false) WITH CHECK (false);

-- DISPUTES
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Block anonymous access (explicit)" ON public.disputes;
CREATE POLICY "Block anonymous access (explicit)" ON public.disputes FOR ALL TO anon USING (false) WITH CHECK (false);

-- NOTE: Invoices already have explicit anon block; warnings can be re-checked in scanner