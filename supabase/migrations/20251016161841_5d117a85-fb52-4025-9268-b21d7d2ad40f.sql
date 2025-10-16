-- Phase 3: Rotation Automatique des Logs (GDPR-compliant)
-- Objectif: Nettoyer logs > 90 jours + Anonymiser metadata > 30 jours
-- Impact: Réduit la croissance DB, améliore performances, conformité GDPR

-- ============================================================================
-- Fonction de Cleanup Automatique
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_old_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Supprimer logs > 90 jours (retention GDPR standard)
  DELETE FROM public.activity_logs 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  DELETE FROM public.profile_access_logs 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  DELETE FROM public.stripe_account_access_audit 
  WHERE accessed_at < NOW() - INTERVAL '90 days';
  
  DELETE FROM public.transaction_access_attempts 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  DELETE FROM public.shared_link_access_logs 
  WHERE accessed_at < NOW() - INTERVAL '90 days';
  
  -- Anonymiser metadata > 30 jours (protection données sensibles)
  UPDATE public.activity_logs 
  SET metadata = '{}'::jsonb 
  WHERE created_at < NOW() - INTERVAL '30 days' 
    AND metadata IS NOT NULL
    AND metadata != '{}'::jsonb;
    
  -- Log le nettoyage pour audit
  RAISE NOTICE 'Cleanup completed at %', NOW();
END;
$$;

-- ============================================================================
-- Scheduler Cron (tous les jours à 3h du matin)
-- ============================================================================

SELECT cron.schedule(
  'cleanup-logs-daily',
  '0 3 * * *', -- 3h du matin tous les jours
  $$SELECT public.cleanup_old_logs()$$
);

-- ============================================================================
-- Exécution immédiate pour nettoyer logs existants (optionnel)
-- ============================================================================

-- Décommenter pour nettoyer immédiatement les logs existants:
-- SELECT public.cleanup_old_logs();