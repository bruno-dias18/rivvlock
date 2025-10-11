-- Étape 1 : Supprimer toutes les politiques qui dépendent des colonnes à supprimer
DROP POLICY IF EXISTS "Users can view their active disputes" ON disputes;
DROP POLICY IF EXISTS "Users can archive resolved disputes" ON disputes;

-- Étape 2 : Supprimer les anciennes colonnes d'archivage
ALTER TABLE public.disputes 
DROP COLUMN IF EXISTS deleted_by_user_id,
DROP COLUMN IF EXISTS deleted_at;

-- Étape 3 : Ajouter les nouvelles colonnes pour archivage individuel
ALTER TABLE public.disputes
ADD COLUMN archived_by_seller boolean DEFAULT false NOT NULL,
ADD COLUMN archived_by_buyer boolean DEFAULT false NOT NULL,
ADD COLUMN seller_archived_at timestamp with time zone,
ADD COLUMN buyer_archived_at timestamp with time zone;

-- Étape 4 : Créer des index pour optimiser les requêtes de filtrage
CREATE INDEX idx_disputes_archived_seller ON public.disputes(transaction_id, archived_by_seller) WHERE archived_by_seller = false;
CREATE INDEX idx_disputes_archived_buyer ON public.disputes(transaction_id, archived_by_buyer) WHERE archived_by_buyer = false;

-- Étape 5 : Recréer la politique de visualisation des litiges (sans deleted_by_user_id)
CREATE POLICY "Users can view their active disputes"
ON disputes
FOR SELECT
USING (
  (
    (reporter_id = auth.uid())
    OR (EXISTS ( SELECT 1
       FROM transactions t
      WHERE ((t.id = disputes.transaction_id) AND (((t.user_id = auth.uid())) OR ((t.buyer_id = auth.uid()))))))
    OR is_admin(auth.uid())
  )
);

-- Étape 6 : Créer la nouvelle politique pour archivage individuel
CREATE POLICY "Users can archive resolved disputes individually"
ON disputes
FOR UPDATE
USING (
  -- Conditions AVANT l'update : qui peut faire l'action
  status::text IN ('resolved', 'resolved_refund', 'resolved_release')
  AND (
    -- L'utilisateur doit être participant (vendeur OU acheteur)
    reporter_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = disputes.transaction_id
      AND (t.user_id = auth.uid() OR t.buyer_id = auth.uid())
    )
  )
)
WITH CHECK (
  -- Conditions APRÈS l'update : vérifier la cohérence
  (
    EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = disputes.transaction_id
      AND (
        (t.user_id = auth.uid() AND disputes.archived_by_seller = true)
        OR (t.buyer_id = auth.uid() AND disputes.archived_by_buyer = true)
      )
    )
  )
);