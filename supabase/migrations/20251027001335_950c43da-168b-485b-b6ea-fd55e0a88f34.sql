-- Nettoyage des transactions "disputed" orphelines (sans dispute associé)
-- Suppression en cascade de toutes les données liées

-- 1. Supprimer les messages liés aux conversations de ces transactions
DELETE FROM public.messages 
WHERE conversation_id IN (
  SELECT id FROM public.conversations 
  WHERE transaction_id IN (
    SELECT id FROM public.transactions 
    WHERE status = 'disputed' 
    AND id NOT IN (SELECT transaction_id FROM public.disputes WHERE transaction_id IS NOT NULL)
  )
);

-- 2. Supprimer les conversations liées
DELETE FROM public.conversations 
WHERE transaction_id IN (
  SELECT id FROM public.transactions 
  WHERE status = 'disputed' 
  AND id NOT IN (SELECT transaction_id FROM public.disputes WHERE transaction_id IS NOT NULL)
);

-- 3. Supprimer les invoices liées
DELETE FROM public.invoices 
WHERE transaction_id IN (
  SELECT id FROM public.transactions 
  WHERE status = 'disputed' 
  AND id NOT IN (SELECT transaction_id FROM public.disputes WHERE transaction_id IS NOT NULL)
);

-- 4. Supprimer les adyen_payouts liés (si existants)
DELETE FROM public.adyen_payouts 
WHERE transaction_id IN (
  SELECT id FROM public.transactions 
  WHERE status = 'disputed' 
  AND id NOT IN (SELECT transaction_id FROM public.disputes WHERE transaction_id IS NOT NULL)
);

-- 5. Enfin, supprimer les transactions orphelines
DELETE FROM public.transactions 
WHERE status = 'disputed' 
AND id NOT IN (SELECT transaction_id FROM public.disputes WHERE transaction_id IS NOT NULL);