-- EMERGENCY FIX: Remove blocking RESTRICTIVE policies on transactions and profiles
-- These policies block ALL access including authenticated users

-- ============================================
-- TRANSACTIONS: Remove broken public block
-- ============================================
DROP POLICY IF EXISTS "public_deny_all_transactions" ON public.transactions;

-- Verify the working participant/admin policies exist
-- (they were created in previous migration)

-- ============================================
-- PROFILES: Remove broken public block  
-- ============================================
DROP POLICY IF EXISTS "public_deny_all_profiles" ON public.profiles;

-- Verify the working self/admin policies exist
-- (they were created in previous migration)