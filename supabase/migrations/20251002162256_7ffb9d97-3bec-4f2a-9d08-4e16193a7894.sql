-- Fix linter: ensure view runs with invoker semantics, not definer
ALTER VIEW public.shared_transactions SET (security_invoker = true);

-- Remove duplicate SELECT policy we added; keep existing admin SELECT policy
DROP POLICY IF EXISTS "Only admins can view access attempts" ON public.transaction_access_attempts;