-- Ensure RLS is enabled on sensitive tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- Explicitly block anonymous (anon) SELECT and ALL operations
-- PROFILES
DROP POLICY IF EXISTS "Block anon SELECT on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Block anon ALL on profiles" ON public.profiles;
CREATE POLICY "Block anon SELECT on profiles"
ON public.profiles
FOR SELECT
TO anon
USING (false);
CREATE POLICY "Block anon ALL on profiles"
ON public.profiles
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- TRANSACTIONS
DROP POLICY IF EXISTS "Block anon SELECT on transactions" ON public.transactions;
DROP POLICY IF EXISTS "Block anon ALL on transactions" ON public.transactions;
CREATE POLICY "Block anon SELECT on transactions"
ON public.transactions
FOR SELECT
TO anon
USING (false);
CREATE POLICY "Block anon ALL on transactions"
ON public.transactions
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- DISPUTES
DROP POLICY IF EXISTS "Block anon SELECT on disputes" ON public.disputes;
DROP POLICY IF EXISTS "Block anon ALL on disputes" ON public.disputes;
CREATE POLICY "Block anon SELECT on disputes"
ON public.disputes
FOR SELECT
TO anon
USING (false);
CREATE POLICY "Block anon ALL on disputes"
ON public.disputes
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Keep existing participant/admin policies intact