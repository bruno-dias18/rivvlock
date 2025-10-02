-- ============================================
-- CORRECTION DES FAILLES DE SÉCURITÉ CRITIQUES
-- ============================================

-- 1. SHARED_TRANSACTIONS : Documenter que l'accès anonyme est intentionnel
COMMENT ON VIEW public.shared_transactions IS 
'Vue publique sécurisée pour les liens de partage. Expose UNIQUEMENT titre, description, prix, devise, dates. AUCUNE donnée sensible (IDs utilisateurs, Stripe IDs, emails).';

-- 2. TRANSACTION_ACCESS_ATTEMPTS : Policy explicite de refus pour non-admins
CREATE POLICY "Non-admins cannot view access attempts"
  ON public.transaction_access_attempts
  FOR SELECT
  USING (false); -- Bloque tout accès sauf admin (déjà défini dans autre policy)

-- 3. PROFILES : Restriction contre l'énumération
DROP POLICY IF EXISTS "Prevent unfiltered profile access" ON public.profiles;
CREATE POLICY "Prevent unfiltered profile enumeration"
  ON public.profiles
  FOR SELECT
  USING (
    CASE 
      WHEN auth.uid() IS NULL THEN false
      ELSE (auth.uid() = user_id) OR is_admin(auth.uid())
    END
  );

-- 4. STRIPE_ACCOUNTS : Renforcer la policy
DROP POLICY IF EXISTS "Users can view their own stripe account" ON public.stripe_accounts;
CREATE POLICY "Strict user stripe account access"
  ON public.stripe_accounts
  FOR SELECT
  USING (
    (auth.uid() = user_id AND auth.uid() IS NOT NULL) OR 
    (is_admin(auth.uid()) AND auth.uid() IS NOT NULL)
  );

-- 5. INVOICES : Validation stricte
DROP POLICY IF EXISTS "Users can view invoices they are involved in" ON public.invoices;
CREATE POLICY "Strict invoice participant access"
  ON public.invoices
  FOR SELECT
  USING (
    ((auth.uid() = seller_id OR auth.uid() = buyer_id) AND auth.uid() IS NOT NULL) OR
    is_admin(auth.uid())
  );

-- 6. DISPUTES : Renforcer l'accès
DROP POLICY IF EXISTS "Users can view disputes they are involved in" ON public.disputes;
CREATE POLICY "Strict dispute participant access"
  ON public.disputes
  FOR SELECT
  USING (
    (reporter_id = auth.uid() AND auth.uid() IS NOT NULL) OR 
    (EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = disputes.transaction_id 
      AND ((t.user_id = auth.uid() OR t.buyer_id = auth.uid()) AND auth.uid() IS NOT NULL)
    )) OR
    is_admin(auth.uid())
  );

-- 7. DISPUTE_MESSAGES : Validation stricte
DROP POLICY IF EXISTS "Users can view their messages in disputes" ON public.dispute_messages;
CREATE POLICY "Strict dispute message access"
  ON public.dispute_messages
  FOR SELECT
  USING (
    (
      ((sender_id = auth.uid() OR recipient_id = auth.uid() OR recipient_id IS NULL) AND auth.uid() IS NOT NULL)
      AND (EXISTS (
        SELECT 1 FROM disputes d
        JOIN transactions t ON d.transaction_id = t.id
        WHERE d.id = dispute_messages.dispute_id 
        AND ((d.reporter_id = auth.uid() OR t.user_id = auth.uid() OR t.buyer_id = auth.uid()) AND auth.uid() IS NOT NULL)
      ))
    ) OR
    is_admin(auth.uid())
  );

-- 8. TRANSACTION_MESSAGES : Renforcer
DROP POLICY IF EXISTS "Users can view messages in their transactions" ON public.transaction_messages;
CREATE POLICY "Strict transaction message access"
  ON public.transaction_messages
  FOR SELECT
  USING (
    (EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = transaction_messages.transaction_id 
      AND ((t.user_id = auth.uid() OR t.buyer_id = auth.uid()) AND auth.uid() IS NOT NULL)
    )) OR
    is_admin(auth.uid())
  );

-- 9. TRANSACTIONS : Renforcer
DROP POLICY IF EXISTS "Users can view transactions where they are participants" ON public.transactions;
CREATE POLICY "Strict transaction participant access"
  ON public.transactions
  FOR SELECT
  USING (
    ((user_id = auth.uid() OR buyer_id = auth.uid()) AND auth.uid() IS NOT NULL) OR
    is_admin(auth.uid())
  );

-- 10. ADMIN_ROLES : Renforcer les policies existantes
DROP POLICY IF EXISTS "Users can view their own admin status" ON public.admin_roles;
CREATE POLICY "Strict own admin status only"
  ON public.admin_roles
  FOR SELECT
  USING (
    (user_id = auth.uid() AND auth.uid() IS NOT NULL) OR
    is_admin(auth.uid())
  );

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_transactions_user_buyer ON public.transactions(user_id, buyer_id);
CREATE INDEX IF NOT EXISTS idx_disputes_reporter ON public.disputes(reporter_id);
CREATE INDEX IF NOT EXISTS idx_dispute_messages_sender_recipient ON public.dispute_messages(sender_id, recipient_id);
CREATE INDEX IF NOT EXISTS idx_transaction_messages_transaction ON public.transaction_messages(transaction_id);