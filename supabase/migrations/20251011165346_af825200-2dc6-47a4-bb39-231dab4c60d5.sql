-- Corriger les litiges dont le délai de résolution est expiré
-- Ces litiges doivent passer au statut 'escalated'
UPDATE public.disputes
SET 
  status = 'escalated',
  escalated_at = COALESCE(escalated_at, now()),
  updated_at = now()
WHERE status IN ('open', 'negotiating', 'responded')
  AND dispute_deadline IS NOT NULL
  AND dispute_deadline < now()
  AND resolved_at IS NULL;