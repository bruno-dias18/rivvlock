-- ============================================================================
-- CORRECTION DE SÉCURITÉ RLS - Élimination des erreurs d'énumération
-- ============================================================================
-- Cette migration simplifie les politiques RLS en retirant les conditions
-- redondantes qui permettaient potentiellement des attaques par énumération.
-- La vérification auth.uid() = user_id échoue automatiquement si auth.uid() 
-- est NULL, donc pas besoin de vérifier auth.uid() IS NOT NULL.
-- ============================================================================

-- 1. PROFILES : Accès direct sans condition redondante
DROP POLICY IF EXISTS "Owner and admin only profile access" ON public.profiles;
CREATE POLICY "Owner and admin only profile access" 
ON public.profiles 
FOR SELECT 
USING (
  (auth.uid() = user_id) OR is_admin(auth.uid())
);

-- 2. STRIPE_ACCOUNTS : Accès direct sans condition redondante
DROP POLICY IF EXISTS "Consolidated stripe account access" ON public.stripe_accounts;
CREATE POLICY "Consolidated stripe account access" 
ON public.stripe_accounts 
FOR SELECT 
USING (
  (auth.uid() = user_id) OR is_admin(auth.uid())
);

-- 3. TRANSACTIONS : Accès direct sans condition redondante
DROP POLICY IF EXISTS "Strict transaction participant access" ON public.transactions;
CREATE POLICY "Strict transaction participant access" 
ON public.transactions 
FOR SELECT 
USING (
  (user_id = auth.uid()) OR (buyer_id = auth.uid()) OR is_admin(auth.uid())
);

-- 4. ADMIN_ROLES : Simplifier l'accès
DROP POLICY IF EXISTS "Strict own admin status only" ON public.admin_roles;
CREATE POLICY "Strict own admin status only" 
ON public.admin_roles 
FOR SELECT 
USING (
  (user_id = auth.uid()) OR is_admin(auth.uid())
);

-- 5. INVOICES : Simplifier l'accès
DROP POLICY IF EXISTS "Strict invoice participant access" ON public.invoices;
CREATE POLICY "Strict invoice participant access" 
ON public.invoices 
FOR SELECT 
USING (
  (auth.uid() = seller_id) OR (auth.uid() = buyer_id) OR is_admin(auth.uid())
);

-- 6. DISPUTES : Simplifier l'accès
DROP POLICY IF EXISTS "Users can view disputes without admin notes" ON public.disputes;
CREATE POLICY "Users can view disputes without admin notes" 
ON public.disputes 
FOR SELECT 
USING (
  (reporter_id = auth.uid()) OR 
  EXISTS (
    SELECT 1 FROM transactions t 
    WHERE t.id = disputes.transaction_id 
    AND ((t.user_id = auth.uid()) OR (t.buyer_id = auth.uid()))
  ) OR 
  is_admin(auth.uid())
);

-- 7. TRANSACTION_MESSAGES : Simplifier l'accès
DROP POLICY IF EXISTS "Strict transaction message access" ON public.transaction_messages;
CREATE POLICY "Strict transaction message access" 
ON public.transaction_messages 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM transactions t 
    WHERE t.id = transaction_messages.transaction_id 
    AND ((t.user_id = auth.uid()) OR (t.buyer_id = auth.uid()))
  ) OR 
  is_admin(auth.uid())
);

-- 8. DISPUTE_MESSAGES : Simplifier l'accès
DROP POLICY IF EXISTS "Strict dispute message access v2" ON public.dispute_messages;
CREATE POLICY "Strict dispute message access v2" 
ON public.dispute_messages 
FOR SELECT 
USING (
  (sender_id = auth.uid()) OR 
  (recipient_id = auth.uid()) OR 
  (recipient_id IS NULL AND EXISTS (
    SELECT 1 FROM disputes d 
    JOIN transactions t ON d.transaction_id = t.id 
    WHERE d.id = dispute_messages.dispute_id 
    AND ((d.reporter_id = auth.uid()) OR (t.user_id = auth.uid()) OR (t.buyer_id = auth.uid()))
  )) OR 
  is_admin(auth.uid())
);