-- Bloquer explicitement l'accès anonyme (non authentifié) aux tables sensibles

-- 1. Bloquer l'accès anonyme à profiles
CREATE POLICY "Block anonymous access to profiles"
ON public.profiles
FOR ALL
TO anon
USING (false);

-- 2. Bloquer l'accès anonyme à stripe_accounts
CREATE POLICY "Block anonymous access to stripe accounts"
ON public.stripe_accounts
FOR ALL
TO anon
USING (false);

-- 3. Bloquer l'accès anonyme à activity_logs
CREATE POLICY "Block anonymous access to activity logs"
ON public.activity_logs
FOR ALL
TO anon
USING (false);