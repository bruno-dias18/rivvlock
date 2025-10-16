-- Mise à jour des politiques RLS pour quote_messages
-- Permet aux clients de lire les messages d'un devis en utilisant leur email

-- Supprimer l'ancienne politique SELECT
DROP POLICY IF EXISTS "quote_messages_select_participants" ON public.quote_messages;

-- Créer une nouvelle politique SELECT qui permet:
-- 1. Au vendeur (seller_id) de voir tous les messages
-- 2. Au client (via sender_email) de voir tous les messages du devis
CREATE POLICY "quote_messages_select_participants" 
ON public.quote_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.quotes q
    WHERE q.id = quote_messages.quote_id
      AND (
        q.seller_id = auth.uid()  -- Vendeur authentifié
        OR quote_messages.sender_email = q.client_email  -- Client via email
      )
  )
);

-- Mise à jour de la politique INSERT pour permettre aux clients non authentifiés
-- de poster des messages en utilisant leur email
DROP POLICY IF EXISTS "quote_messages_insert_participants" ON public.quote_messages;

CREATE POLICY "quote_messages_insert_participants"
ON public.quote_messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.quotes q
    WHERE q.id = quote_messages.quote_id
      AND (
        q.seller_id = auth.uid()  -- Vendeur authentifié
        OR sender_email = q.client_email  -- Client via email (peut être non auth)
      )
  )
);