-- Corriger user_disputes pour utiliser SECURITY INVOKER
ALTER VIEW public.user_disputes SET (security_invoker = true);