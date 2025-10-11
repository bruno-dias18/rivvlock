-- Ajouter la colonne rejected_by pour tracer qui a refusé la proposition
ALTER TABLE dispute_proposals 
ADD COLUMN rejected_by uuid REFERENCES auth.users(id);

-- Créer un index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_dispute_proposals_rejected_by 
ON dispute_proposals(rejected_by);

-- Commentaire pour documentation
COMMENT ON COLUMN dispute_proposals.rejected_by IS 
'ID de l''utilisateur (acheteur ou vendeur) qui a refusé la proposition officielle';