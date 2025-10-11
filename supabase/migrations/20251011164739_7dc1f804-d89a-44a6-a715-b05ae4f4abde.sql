-- Corriger les statuts des disputes escaladées
-- Les disputes avec escalated_at défini doivent avoir le statut 'escalated'
UPDATE disputes 
SET status = 'escalated'
WHERE escalated_at IS NOT NULL 
  AND status NOT IN ('escalated', 'resolved', 'resolved_refund', 'resolved_release');