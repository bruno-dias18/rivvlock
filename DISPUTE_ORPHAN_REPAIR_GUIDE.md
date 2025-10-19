# Guide de réparation des litiges orphelins

## Contexte

Suite à la migration Phase 5 vers l'architecture unifiée, certains litiges peuvent se retrouver sans `conversation_id` (orphelins), ce qui les rend invisibles dans l'interface utilisateur.

## Causes possibles

1. **Triggers de synchronisation manquants** : Les triggers bidirectionnels entre `disputes` et `conversations` n'étaient pas actifs
2. **Migration incomplète** : Certains litiges créés avant la migration n'ont pas été migrés
3. **Échec de création de conversation** : Problème lors de la création d'un nouveau litige

## Solution automatique

### 1. Triggers de synchronisation (✅ Implémentés)

Deux triggers assurent maintenant la synchronisation bidirectionnelle :

```sql
-- disputes → conversations
CREATE TRIGGER trg_sync_dispute_to_conversation
AFTER INSERT OR UPDATE OF conversation_id ON public.disputes
FOR EACH ROW
WHEN (NEW.conversation_id IS NOT NULL)
EXECUTE FUNCTION public.sync_dispute_conversation_complete();

-- conversations → disputes
CREATE TRIGGER trg_sync_conversation_to_dispute
AFTER INSERT OR UPDATE OF dispute_id ON public.conversations
FOR EACH ROW
WHEN (NEW.dispute_id IS NOT NULL)
EXECUTE FUNCTION public.sync_conversation_to_dispute();
```

### 2. Fonction de réparation automatique

Une fonction SQL permet de détecter et réparer automatiquement tous les litiges orphelins :

```sql
SELECT * FROM public.repair_orphan_disputes();
```

Cette fonction :
- ✅ Détecte tous les litiges actifs sans `conversation_id`
- ✅ Crée une conversation publique pour chaque litige orphelin
- ✅ Lie bidirectionnellement le litige et la conversation
- ✅ Retourne un rapport des litiges réparés

### 3. Fallbacks dans le code frontend (✅ Implémentés)

**Dans `useDisputesUnified.ts`** :
```typescript
// CRITICAL FALLBACK: Fetch disputes without conversation_id
const { data: orphanDisputesWithoutConv } = await supabase
  .from('disputes')
  .select('*')
  .is('conversation_id', null)
  .not('status', 'in', '(resolved,resolved_refund,resolved_release)');

if (orphanDisputesWithoutConv && orphanDisputesWithoutConv.length > 0) {
  logger.warn('Found orphan disputes without conversation_id', {
    count: orphanDisputesWithoutConv.length,
    ids: orphanDisputesWithoutConv.map((d: any) => d.id),
  });
  disputes = [...disputes, ...orphanDisputesWithoutConv];
}
```

**Dans `useUnreadDisputesGlobal.ts`** :
```typescript
// Get all active disputes (including those without conversation_id)
const { data: disputes } = await supabase
  .from('disputes')
  .select('id, conversation_id, status')
  .not('status', 'in', '(resolved,resolved_refund,resolved_release)');
// ❌ RETIRÉ: .not('conversation_id', 'is', null)
```

## Diagnostic manuel

### Détecter les litiges orphelins

```sql
SELECT 
  d.id,
  d.status,
  d.conversation_id,
  d.created_at,
  t.id as transaction_id,
  t.user_id as seller_id,
  t.buyer_id
FROM disputes d
JOIN transactions t ON t.id = d.transaction_id
WHERE d.conversation_id IS NULL
  AND d.status NOT IN ('resolved', 'resolved_refund', 'resolved_release')
ORDER BY d.created_at DESC;
```

### Vérifier l'état d'un litige spécifique

```sql
SELECT 
  d.id as dispute_id,
  d.status,
  d.conversation_id,
  d.escalated_at,
  t.id as transaction_id,
  t.user_id as seller_id,
  t.buyer_id,
  COUNT(c.id) as admin_conversations_count
FROM disputes d
JOIN transactions t ON t.id = d.transaction_id
LEFT JOIN conversations c ON c.dispute_id = d.id 
  AND c.conversation_type IN ('admin_seller_dispute', 'admin_buyer_dispute')
WHERE d.id = '<DISPUTE_ID>'
GROUP BY d.id, d.status, d.conversation_id, d.escalated_at, t.id, t.user_id, t.buyer_id;
```

## Réparation manuelle (si nécessaire)

### Pour un litige spécifique NON escaladé

```sql
DO $$
DECLARE
  v_dispute_id uuid := '<DISPUTE_ID>';
  v_conversation_id uuid;
  v_transaction_id uuid;
  v_seller_id uuid;
  v_buyer_id uuid;
BEGIN
  -- Récupérer les infos du litige
  SELECT d.transaction_id, t.user_id, t.buyer_id
  INTO v_transaction_id, v_seller_id, v_buyer_id
  FROM disputes d
  JOIN transactions t ON t.id = d.transaction_id
  WHERE d.id = v_dispute_id;

  -- Créer une conversation publique
  INSERT INTO public.conversations (
    seller_id,
    buyer_id,
    transaction_id,
    conversation_type,
    dispute_id,
    status
  ) VALUES (
    v_seller_id,
    v_buyer_id,
    v_transaction_id,
    'dispute',
    v_dispute_id,
    'active'
  )
  RETURNING id INTO v_conversation_id;

  -- Lier la conversation au litige
  UPDATE public.disputes
  SET conversation_id = v_conversation_id,
      updated_at = now()
  WHERE id = v_dispute_id;

  RAISE NOTICE 'Litige % réparé avec conversation %', v_dispute_id, v_conversation_id;
END $$;
```

### Pour un litige escaladé

Si le litige est escaladé et que les conversations admin existent déjà :

```sql
-- 1. Lier les conversations admin au dispute_id
UPDATE public.conversations
SET dispute_id = '<DISPUTE_ID>'
WHERE id IN (
  '<ADMIN_SELLER_CONV_ID>',
  '<ADMIN_BUYER_CONV_ID>'
);

-- 2. Créer la conversation publique historique
INSERT INTO public.conversations (
  seller_id,
  buyer_id,
  transaction_id,
  conversation_type,
  dispute_id,
  status
)
SELECT 
  t.user_id,
  t.buyer_id,
  d.transaction_id,
  'dispute',
  d.id,
  'active'
FROM disputes d
JOIN transactions t ON t.id = d.transaction_id
WHERE d.id = '<DISPUTE_ID>'
RETURNING id;

-- 3. Lier au dispute
UPDATE public.disputes
SET conversation_id = '<RETURNED_ID>'
WHERE id = '<DISPUTE_ID>';
```

## Prévention

### 1. Toujours vérifier les triggers

```sql
-- Vérifier que les triggers sont actifs
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name IN (
  'trg_sync_dispute_to_conversation',
  'trg_sync_conversation_to_dispute'
)
ORDER BY trigger_name;
```

### 2. Monitoring automatique

Ajouter une tâche cron qui exécute périodiquement :

```sql
SELECT * FROM public.repair_orphan_disputes();
```

### 3. Tests de non-régression

Lors de la création d'un nouveau litige :

1. ✅ Vérifier que `conversation_id` est non-NULL
2. ✅ Vérifier que la conversation a le bon `dispute_id`
3. ✅ Vérifier que le `conversation_type` est 'dispute'
4. ✅ Vérifier que le litige s'affiche dans l'UI

## Checklist de validation

- [ ] Les triggers de synchronisation sont actifs
- [ ] Aucun litige orphelin détecté (`SELECT * FROM repair_orphan_disputes()` retourne 0 lignes)
- [ ] Les nouveaux litiges créent automatiquement leur conversation
- [ ] Le badge "Litiges (X)" affiche le bon nombre
- [ ] Les litiges s'affichent correctement dans l'interface
- [ ] Les conversations admin sont correctement liées pour les litiges escaladés

## Logs et debugging

### Frontend

Les logs suivants devraient apparaître en cas de litige orphelin :

```
WARN: Found orphan disputes without conversation_id
  count: 1
  ids: ['27964f7d-c92b-4768-8f63-95fa57255102']
```

### Base de données

Activer les notices PostgreSQL :

```sql
SET client_min_messages = 'notice';
SELECT * FROM public.repair_orphan_disputes();
```

Devrait afficher :
```
NOTICE: Litige 27964f7d-c92b-4768-8f63-95fa57255102 réparé avec conversation <UUID>
```

## Contact support

En cas de problème persistant :
1. Exécuter `SELECT * FROM public.repair_orphan_disputes()`
2. Vérifier les logs frontend (console)
3. Vérifier les logs PostgreSQL (Supabase Dashboard)
4. Fournir les résultats des requêtes de diagnostic ci-dessus
