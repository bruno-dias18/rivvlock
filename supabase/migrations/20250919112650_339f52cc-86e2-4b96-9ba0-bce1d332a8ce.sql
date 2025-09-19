-- Nettoyage de la base de données - Conservation uniquement des données admin
-- Admin user_id: 0a3bc1b2-0d00-412e-a6da-5554abc42aaf (bruno-dias@outlook.com)

-- 1. Supprimer tous les messages des transactions qui ne concernent pas l'admin
DELETE FROM public.messages 
WHERE transaction_id NOT IN (
  SELECT id FROM public.transactions 
  WHERE user_id = '0a3bc1b2-0d00-412e-a6da-5554abc42aaf' 
     OR buyer_id = '0a3bc1b2-0d00-412e-a6da-5554abc42aaf'
);

-- 2. Supprimer toutes les disputes des transactions qui ne concernent pas l'admin
DELETE FROM public.disputes 
WHERE transaction_id NOT IN (
  SELECT id FROM public.transactions 
  WHERE user_id = '0a3bc1b2-0d00-412e-a6da-5554abc42aaf' 
     OR buyer_id = '0a3bc1b2-0d00-412e-a6da-5554abc42aaf'
);

-- 3. Supprimer toutes les transactions sauf celles de l'admin
DELETE FROM public.transactions 
WHERE user_id != '0a3bc1b2-0d00-412e-a6da-5554abc42aaf' 
  AND (buyer_id IS NULL OR buyer_id != '0a3bc1b2-0d00-412e-a6da-5554abc42aaf');

-- 4. Supprimer tous les comptes Stripe sauf celui de l'admin
DELETE FROM public.stripe_accounts 
WHERE user_id != '0a3bc1b2-0d00-412e-a6da-5554abc42aaf';

-- 5. Supprimer tous les logs d'audit sauf ceux de l'admin
DELETE FROM public.profile_audit_log 
WHERE user_id != '0a3bc1b2-0d00-412e-a6da-5554abc42aaf';

-- 6. Supprimer tous les profils sauf celui de l'admin
DELETE FROM public.profiles 
WHERE user_id != '0a3bc1b2-0d00-412e-a6da-5554abc42aaf';

-- 7. S'assurer que l'admin a bien son rôle (insertion sécurisée)
INSERT INTO public.admin_roles (user_id, email, role)
VALUES ('0a3bc1b2-0d00-412e-a6da-5554abc42aaf', 'bruno-dias@outlook.com', 'admin')
ON CONFLICT (user_id, email) DO NOTHING;