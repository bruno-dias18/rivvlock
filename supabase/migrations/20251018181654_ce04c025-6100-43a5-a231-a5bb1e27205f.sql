
-- Correctif Phase 5 : Mettre à jour les conversations de disputes avec le bon type
-- Problème : Certaines conversations de disputes ont le type 'transaction' au lieu de 'dispute'

UPDATE conversations c
SET 
  conversation_type = 'dispute',
  updated_at = now()
FROM disputes d
WHERE 
  c.id = d.conversation_id
  AND c.conversation_type != 'dispute'
  AND d.conversation_id IS NOT NULL;

-- Vérification post-migration
DO $$
DECLARE
  wrong_count integer;
BEGIN
  SELECT COUNT(*) INTO wrong_count
  FROM disputes d
  JOIN conversations c ON d.conversation_id = c.id
  WHERE c.conversation_type != 'dispute';
  
  IF wrong_count > 0 THEN
    RAISE WARNING 'Il reste % disputes avec le mauvais conversation_type', wrong_count;
  ELSE
    RAISE NOTICE 'Tous les disputes ont maintenant le bon conversation_type = dispute';
  END IF;
END $$;
