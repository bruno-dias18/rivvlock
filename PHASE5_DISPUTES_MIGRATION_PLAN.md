# Phase 5 : Migration des Disputes vers Architecture Unifiée

## 🎯 Objectif

Migrer le système de disputes vers l'architecture unifiée de messaging tout en garantissant **zéro régression** sur cette fonctionnalité critique.

## ⚠️ Niveau de Risque : ÉLEVÉ

**Pourquoi ?**
- Disputes = fonctionnalité critique pour la résolution de conflits
- Impact direct sur les utilisateurs en litige
- Logique métier complexe (propositions, deadlines, escalations)

**Mitigation :**
- Migration progressive avec feature flags
- Double-running temporaire pour validation
- Rollback instantané (< 5 min)

---

## 📋 État Actuel

### Architecture Disputes Actuelle (Séparée)

**Tables dédiées :**
- `disputes` - Table principale des litiges
- `dispute_proposals` - Propositions de résolution
- `admin_dispute_notes` - Notes privées admin

**Logique spécifique :**
- Messages privés admin ↔ seller / buyer
- Propositions avec validation bipartite
- Escalations automatiques après deadline
- Archivage individuel par partie

### Architecture Unifiée (Transactions + Quotes)

**Tables :**
- `conversations` - Conversations unifiées
- `messages` - Messages unifiés
- `conversation_reads` - Statuts de lecture
- `message_reads` - Lectures de messages

**Optimisations déjà en place :**
- 70-80% réduction requêtes API
- 50-70% réduction re-renders
- Cache persistant IndexedDB
- Queries optimisées

---

## 🔄 Plan de Migration en 4 Étapes

### Étape 1 : Préparation (Semaine 1)

#### 1.1 Analyse et Tests
- ✅ Audit complet des disputes existantes
- ✅ Identification des edge cases
- ✅ Création de disputes de test

#### 1.2 Extension du Schéma Unifié
```sql
-- Ajouter support disputes dans conversations
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS dispute_id uuid REFERENCES disputes(id);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_conversations_dispute_id 
ON conversations(dispute_id) WHERE dispute_id IS NOT NULL;

-- Étendre conversation_type enum
ALTER TYPE conversation_type 
ADD VALUE IF NOT EXISTS 'dispute' AFTER 'quote';

ALTER TYPE conversation_type 
ADD VALUE IF NOT EXISTS 'admin_seller_dispute' AFTER 'dispute';

ALTER TYPE conversation_type 
ADD VALUE IF NOT EXISTS 'admin_buyer_dispute' AFTER 'admin_seller_dispute';
```

#### 1.3 Feature Flags
```typescript
// src/lib/featureFlags.ts
export const FEATURES = {
  UNIFIED_DISPUTES: false, // ← Toggle pour activer/désactiver
  DOUBLE_RUNNING: true,    // ← Mode validation parallèle
} as const;
```

---

### Étape 2 : Migration des Données (Semaine 2)

#### 2.1 Script de Migration Données
```sql
-- Créer conversations pour disputes existantes
INSERT INTO conversations (
  seller_id,
  buyer_id,
  dispute_id,
  conversation_type,
  status,
  created_at,
  updated_at
)
SELECT 
  t.user_id as seller_id,
  t.buyer_id,
  d.id as dispute_id,
  'dispute'::conversation_type,
  CASE 
    WHEN d.status IN ('resolved', 'resolved_refund', 'resolved_release') 
    THEN 'closed'
    ELSE 'active'
  END,
  d.created_at,
  d.updated_at
FROM disputes d
JOIN transactions t ON t.id = d.transaction_id
WHERE d.conversation_id IS NULL
ON CONFLICT DO NOTHING;

-- Lier disputes aux conversations créées
UPDATE disputes d
SET conversation_id = c.id
FROM conversations c
WHERE c.dispute_id = d.id
AND d.conversation_id IS NULL;
```

#### 2.2 Validation Post-Migration
```sql
-- Vérifier que toutes les disputes ont une conversation
SELECT COUNT(*) as disputes_sans_conversation
FROM disputes 
WHERE conversation_id IS NULL;
-- Doit retourner 0

-- Vérifier l'intégrité des liens
SELECT COUNT(*) as conversations_orphelines
FROM conversations c
WHERE c.conversation_type IN ('dispute', 'admin_seller_dispute', 'admin_buyer_dispute')
AND NOT EXISTS (
  SELECT 1 FROM disputes d WHERE d.id = c.dispute_id
);
-- Doit retourner 0
```

---

### Étape 3 : Implémentation Code (Semaine 3)

#### 3.1 Adapter les Hooks
```typescript
// src/hooks/useDisputes.ts - VERSION UNIFIÉE
export function useDisputes() {
  if (!FEATURES.UNIFIED_DISPUTES) {
    return useDisputesLegacy(); // ← Ancien système
  }

  // Nouveau système unifié
  const { data: disputes } = useQuery({
    queryKey: ['disputes', 'unified'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          dispute:disputes!disputes_conversation_id_fkey(*),
          messages(count),
          unread:conversation_reads!left(*)
        `)
        .in('conversation_type', ['dispute', 'admin_seller_dispute', 'admin_buyer_dispute'])
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    staleTime: 30_000, // ← Même optimisation que transactions
  });

  return disputes;
}
```

#### 3.2 Composants avec Double-Running
```typescript
// src/components/DisputeCard.tsx
export function DisputeCard({ disputeId }: Props) {
  const disputeUnified = useDispute(disputeId); // Nouveau
  const disputeLegacy = useDisputeLegacy(disputeId); // Ancien

  // Mode double-running : comparer les deux
  if (FEATURES.DOUBLE_RUNNING) {
    useEffect(() => {
      if (!isEqual(disputeUnified, disputeLegacy)) {
        logger.error('DISPUTE_MISMATCH', {
          unified: disputeUnified,
          legacy: disputeLegacy,
        });
      }
    }, [disputeUnified, disputeLegacy]);
  }

  const dispute = FEATURES.UNIFIED_DISPUTES 
    ? disputeUnified 
    : disputeLegacy;

  return <DisputeCardContent dispute={dispute} />;
}
```

---

### Étape 4 : Déploiement Progressif (Semaine 4)

#### 4.1 Alpha (24h) - Admin Only
```typescript
FEATURES.UNIFIED_DISPUTES = true;  // Activer pour admins uniquement
FEATURES.DOUBLE_RUNNING = true;    // Validation parallèle
```

**Monitoring :**
- ✅ Aucune erreur console
- ✅ Temps de chargement < 500ms
- ✅ 0 mismatch entre legacy/unified

#### 4.2 Beta (48h) - 10% Users
```typescript
// Activation progressive par user_id
const enabledUsers = [/* 10% random sample */];
FEATURES.UNIFIED_DISPUTES = enabledUsers.includes(userId);
```

**Métriques :**
- Taux d'erreur < 0.1%
- Performance égale ou meilleure
- Feedback utilisateurs positif

#### 4.3 Production (72h) - 100%
```typescript
FEATURES.UNIFIED_DISPUTES = true;
FEATURES.DOUBLE_RUNNING = false;  // Désactiver double-running
```

#### 4.4 Cleanup (Semaine 5)
```typescript
// Supprimer ancien code legacy
// Supprimer feature flags
// Nettoyer les anciennes tables si souhaité
```

---

## 🚨 Plan de Rollback

### Rollback Instantané (< 5 min)

```typescript
// 1. Désactiver feature flag
FEATURES.UNIFIED_DISPUTES = false;

// 2. Clear cache React Query
queryClient.clear();

// 3. Redéployer
// Le système revient automatiquement à l'ancienne architecture
```

### Rollback Base de Données (< 30 min)

```sql
-- Si besoin de revenir en arrière sur les données
-- 1. Désactiver les nouvelles conversations
UPDATE conversations 
SET status = 'inactive'
WHERE conversation_type IN ('dispute', 'admin_seller_dispute', 'admin_buyer_dispute');

-- 2. Les disputes continuent de fonctionner avec l'ancien système
-- Aucune perte de données
```

---

## 📊 Métriques de Succès

### Performance
- ✅ Temps de chargement disputes < 500ms (vs 1200ms actuellement)
- ✅ Réduction 70% requêtes API (comme transactions)
- ✅ Cache hit rate > 80%

### Stabilité
- ✅ 0 régression fonctionnelle
- ✅ Taux d'erreur < 0.1%
- ✅ 100% disputes accessibles

### Maintenance
- ✅ -60% code dupliqué
- ✅ 1 seul système de messaging
- ✅ Optimisations partagées

---

## ✅ Checklist de Validation

### Avant Migration
- [ ] Backup complet base de données
- [ ] Tests end-to-end disputes legacy OK
- [ ] Feature flags implémentés
- [ ] Monitoring Sentry configuré
- [ ] Plan rollback documenté

### Pendant Migration
- [ ] Script migration exécuté sans erreur
- [ ] Validation données post-migration OK
- [ ] Double-running activé
- [ ] Aucun mismatch détecté

### Après Migration
- [ ] Tests end-to-end unified OK
- [ ] Performance égale ou meilleure
- [ ] 0 erreur production 24h
- [ ] Feedback utilisateurs positif
- [ ] Cleanup ancien code

---

## 🎯 Décision Finale

### GO si :
✅ Tous les tests passent  
✅ Performance égale ou meilleure  
✅ 0 mismatch en double-running  
✅ Rollback plan testé  

### NO-GO si :
❌ Erreurs critiques détectées  
❌ Performance dégradée  
❌ Mismatches fréquents  
❌ Feedback négatif users  

---

## 📝 Notes Importantes

1. **Historique existant** : Comme confirmé, l'historique des litiges peut être supprimé si nécessaire. Nous garderons les disputes actives mais pourrons nettoyer les anciennes.

2. **Logique métier préservée** : Toute la logique spécifique aux disputes (propositions, escalations, deadlines) reste **identique**. Seule la couche messaging est unifiée.

3. **Avantages à long terme** :
   - Une seule architecture de messaging
   - Toutes les optimisations profitent aux disputes
   - Code plus maintenable
   - Nouvelles features messaging automatiquement disponibles

4. **Risque mitigé** :
   - Feature flags = rollback instant
   - Double-running = validation continue
   - Migration progressive = impact limité
   - Monitoring renforcé = détection précoce

---

**Prêt à démarrer la Phase 5 avec cette approche sécurisée ?**
