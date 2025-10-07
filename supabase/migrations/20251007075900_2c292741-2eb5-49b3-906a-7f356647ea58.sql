-- Ajouter la colonne refund_status à la table transactions
ALTER TABLE public.transactions 
ADD COLUMN refund_status text NOT NULL DEFAULT 'none' 
CHECK (refund_status IN ('none', 'partial', 'full'));

-- Créer un index pour améliorer les performances des requêtes
CREATE INDEX idx_transactions_refund_status ON public.transactions(refund_status);

-- Mettre à jour les transactions existantes avec des litiges résolus et remboursement total
UPDATE public.transactions t
SET refund_status = 'full'
FROM public.disputes d
WHERE t.id = d.transaction_id
  AND d.status = 'resolved_refund'
  AND (d.resolution LIKE '%100%' OR d.resolution LIKE '%full%');

-- Mettre à jour les transactions existantes avec des litiges résolus et remboursement partiel
UPDATE public.transactions t
SET refund_status = 'partial'
FROM public.disputes d
WHERE t.id = d.transaction_id
  AND d.status = 'resolved_refund'
  AND d.resolution NOT LIKE '%100%'
  AND d.resolution NOT LIKE '%full%'
  AND t.refund_status = 'none';