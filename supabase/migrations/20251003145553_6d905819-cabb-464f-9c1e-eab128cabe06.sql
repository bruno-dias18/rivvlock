-- Enforce strict RLS and explicit anonymous deny on all sensitive tables

-- Helper macro-like pattern: drop named policy first to avoid conflicts, then create

-- activity_logs
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anon deny ALL on activity_logs" ON public.activity_logs;
CREATE POLICY "Anon deny ALL on activity_logs" ON public.activity_logs FOR ALL TO anon USING (false) WITH CHECK (false);

-- admin_roles
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_roles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anon deny ALL on admin_roles" ON public.admin_roles;
CREATE POLICY "Anon deny ALL on admin_roles" ON public.admin_roles FOR ALL TO anon USING (false) WITH CHECK (false);

-- dispute_messages
ALTER TABLE public.dispute_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_messages FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anon deny ALL on dispute_messages" ON public.dispute_messages;
CREATE POLICY "Anon deny ALL on dispute_messages" ON public.dispute_messages FOR ALL TO anon USING (false) WITH CHECK (false);

-- dispute_proposals
ALTER TABLE public.dispute_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_proposals FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anon deny ALL on dispute_proposals" ON public.dispute_proposals;
CREATE POLICY "Anon deny ALL on dispute_proposals" ON public.dispute_proposals FOR ALL TO anon USING (false) WITH CHECK (false);

-- disputes
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anon deny ALL on disputes" ON public.disputes;
CREATE POLICY "Anon deny ALL on disputes" ON public.disputes FOR ALL TO anon USING (false) WITH CHECK (false);

-- invoices
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anon deny ALL on invoices" ON public.invoices;
CREATE POLICY "Anon deny ALL on invoices" ON public.invoices FOR ALL TO anon USING (false) WITH CHECK (false);

-- invoice_sequences
ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_sequences FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anon deny ALL on invoice_sequences" ON public.invoice_sequences;
CREATE POLICY "Anon deny ALL on invoice_sequences" ON public.invoice_sequences FOR ALL TO anon USING (false) WITH CHECK (false);

-- message_reads
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anon deny ALL on message_reads" ON public.message_reads;
CREATE POLICY "Anon deny ALL on message_reads" ON public.message_reads FOR ALL TO anon USING (false) WITH CHECK (false);

-- profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anon deny ALL on profiles" ON public.profiles;
CREATE POLICY "Anon deny ALL on profiles" ON public.profiles FOR ALL TO anon USING (false) WITH CHECK (false);

-- stripe_accounts
ALTER TABLE public.stripe_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_accounts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anon deny ALL on stripe_accounts" ON public.stripe_accounts;
CREATE POLICY "Anon deny ALL on stripe_accounts" ON public.stripe_accounts FOR ALL TO anon USING (false) WITH CHECK (false);

-- transaction_messages
ALTER TABLE public.transaction_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_messages FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anon deny ALL on transaction_messages" ON public.transaction_messages;
CREATE POLICY "Anon deny ALL on transaction_messages" ON public.transaction_messages FOR ALL TO anon USING (false) WITH CHECK (false);

-- transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anon deny ALL on transactions" ON public.transactions;
CREATE POLICY "Anon deny ALL on transactions" ON public.transactions FOR ALL TO anon USING (false) WITH CHECK (false);
