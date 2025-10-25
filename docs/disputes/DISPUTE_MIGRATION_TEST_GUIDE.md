# Guide de Test - Migration Disputes (Phase 5)

## ✅ État Actuel du Système

### Architecture Unifiée Active
- ✅ Système unifié activé (`UNIFIED_DISPUTES: true`)
- ✅ Code legacy supprimé (`useDisputesLegacy`, `disputeMigrationUtils`)
- ✅ Edge functions migrées vers système unifié
- ✅ RLS activé sur toutes les tables disputes
- ✅ Conversations admin séparées créées

### Données Existantes
```
- 1 conversation admin_seller_dispute (0 messages)
- 1 conversation admin_buyer_dispute (0 messages)
```

---

## 🧪 Scénarios de Test Manuels

### Test 1️⃣ : Création d'un Litige (Buyer)

**Objectif** : Vérifier que la création d'un litige crée bien la conversation unifiée

**Prérequis** :
- 1 transaction en statut `paid`
- Connecté en tant qu'acheteur

**Actions** :
1. Aller sur la transaction
2. Cliquer "Créer un litige"
3. Sélectionner un type (ex: "Problème de qualité")
4. Écrire un message initial : "Le produit ne correspond pas à la description"
5. Valider

**Résultats Attendus** :
- ✅ Litige créé avec statut `open`
- ✅ `conversation_id` lié au litige
- ✅ Message initial visible dans la conversation
- ✅ Deadline de 48h affichée
- ✅ Notification envoyée au vendeur
- ✅ Activity log créé

**Vérifications DB** :
```sql
-- Vérifier que le litige a une conversation
SELECT id, status, conversation_id, dispute_deadline 
FROM disputes 
WHERE transaction_id = 'VOTRE_TRANSACTION_ID';

-- Vérifier les messages
SELECT m.message, m.message_type, m.created_at
FROM messages m
JOIN disputes d ON d.conversation_id = m.conversation_id
WHERE d.id = 'VOTRE_DISPUTE_ID'
ORDER BY m.created_at;
```

---

### Test 2️⃣ : Échange de Messages Buyer ↔ Seller (Pre-Escalation)

**Objectif** : Vérifier la messagerie unifiée avant escalade

**Actions** :
1. **En tant que Seller** : Répondre au litige via la conversation
2. **En tant que Buyer** : Répondre à nouveau
3. Vérifier les compteurs de messages non lus

**Résultats Attendus** :
- ✅ Messages visibles en temps réel pour les deux parties
- ✅ Compteurs non lus corrects
- ✅ Statut du litige passe à `responded` après réponse vendeur
- ✅ Aucun admin ne peut voir ces messages (privés)

**Vérifications DB** :
```sql
-- Vérifier que les messages sont dans la bonne conversation
SELECT 
  m.sender_id,
  m.message,
  m.message_type,
  c.conversation_type
FROM messages m
JOIN conversations c ON c.id = m.conversation_id
WHERE c.dispute_id = 'VOTRE_DISPUTE_ID'
  AND c.conversation_type = 'transaction'
ORDER BY m.created_at;
```

---

### Test 3️⃣ : Escalade Manuelle Admin

**Objectif** : Vérifier la création des conversations admin séparées

**Actions** :
1. **En tant qu'Admin** : Aller sur la page Admin Disputes
2. Trouver le litige créé
3. Cliquer "Escalader maintenant"

**Résultats Attendus** :
- ✅ Statut litige → `escalated`
- ✅ `escalated_at` renseigné
- ✅ 2 conversations créées :
  - `admin_seller_dispute` (Admin ↔ Seller)
  - `admin_buyer_dispute` (Admin ↔ Buyer)
- ✅ Message système dans conversation publique : "⚠️ Ce litige a été escaladé..."
- ✅ **BLOCAGE** : Buyer et Seller ne peuvent plus s'envoyer de messages directs
- ✅ Notifications envoyées aux deux parties

**Vérifications DB** :
```sql
-- Vérifier les conversations admin créées
SELECT 
  id,
  conversation_type,
  seller_id,
  buyer_id,
  admin_id
FROM conversations
WHERE dispute_id = 'VOTRE_DISPUTE_ID';

-- Devrait retourner 3 lignes :
-- 1. transaction (seller_id + buyer_id, admin_id NULL)
-- 2. admin_seller_dispute (seller_id, admin_id, buyer_id NULL)
-- 3. admin_buyer_dispute (buyer_id, admin_id, seller_id NULL)
```

---

### Test 4️⃣ : Messagerie Admin Séparée

**Objectif** : Vérifier l'isolation des conversations admin

**Actions** :
1. **En tant qu'Admin** : Ouvrir le litige escaladé
2. Envoyer un message à **Seller** : "Pouvez-vous fournir des preuves ?"
3. **En tant que Seller** : Vérifier que seul ce message est visible (pas les messages avec buyer)
4. **En tant qu'Admin** : Envoyer un message à **Buyer** : "Avez-vous des photos ?"
5. **En tant que Buyer** : Vérifier l'isolation

**Résultats Attendus** :
- ✅ Seller voit uniquement les messages Admin ↔ Seller
- ✅ Buyer voit uniquement les messages Admin ↔ Buyer
- ✅ Admin voit les deux conversations séparément
- ✅ **ISOLATION TOTALE** : Seller et Buyer ne voient JAMAIS les messages de l'autre partie avec l'admin

**Vérifications DB** :
```sql
-- Messages Admin → Seller
SELECT m.message, m.message_type
FROM messages m
JOIN conversations c ON c.id = m.conversation_id
WHERE c.dispute_id = 'VOTRE_DISPUTE_ID'
  AND c.conversation_type = 'admin_seller_dispute';

-- Messages Admin → Buyer
SELECT m.message, m.message_type
FROM messages m
JOIN conversations c ON c.id = m.conversation_id
WHERE c.dispute_id = 'VOTRE_DISPUTE_ID'
  AND c.conversation_type = 'admin_buyer_dispute';
```

---

### Test 5️⃣ : Proposition Officielle Admin

**Objectif** : Vérifier que les deux parties doivent valider

**Actions** :
1. **En tant qu'Admin** : Créer une proposition officielle : "Remboursement partiel 50%"
2. **En tant que Seller** : Valider la proposition
3. **En tant que Buyer** : Valider la proposition
4. Vérifier la résolution

**Résultats Attendus** :
- ✅ Proposition créée avec `admin_created: true` et `requires_both_parties: true`
- ✅ `seller_validated: false`, `buyer_validated: false` initialement
- ✅ Après validation Seller : `seller_validated: true`
- ✅ Après validation Buyer : `buyer_validated: true`
- ✅ Litige passe à `resolved_refund` ou `resolved_release`
- ✅ Remboursement/transfert exécuté via Stripe

**Vérifications DB** :
```sql
-- Proposition admin
SELECT 
  proposal_type,
  refund_percentage,
  admin_created,
  requires_both_parties,
  seller_validated,
  buyer_validated,
  status
FROM dispute_proposals
WHERE dispute_id = 'VOTRE_DISPUTE_ID'
  AND admin_created = true;
```

---

### Test 6️⃣ : Escalade Automatique (Deadline)

**Objectif** : Vérifier l'escalade auto après 48h

**Prérequis** :
- 1 litige en statut `open` ou `negotiating`
- `dispute_deadline` dépassé (vous pouvez le modifier manuellement en DB)

**Actions** :
1. Modifier la deadline pour la mettre dans le passé :
```sql
UPDATE disputes 
SET dispute_deadline = NOW() - INTERVAL '1 hour'
WHERE id = 'VOTRE_DISPUTE_ID';
```

2. Attendre l'exécution du cron (ou l'invoquer manuellement) :
```bash
# Via Supabase Dashboard → Edge Functions → process-dispute-deadlines
```

**Résultats Attendus** :
- ✅ Statut passe à `escalated`
- ✅ `escalated_at` renseigné
- ✅ Conversations admin créées automatiquement
- ✅ Message système : "⚠️ Escaladé automatiquement après 48h"
- ✅ Activity logs pour les deux parties
- ✅ Notifications envoyées

---

### Test 7️⃣ : Archivage Individuel

**Objectif** : Vérifier que chaque partie peut archiver indépendamment

**Actions** :
1. Résoudre un litige
2. **En tant que Seller** : Archiver le litige
3. **En tant que Buyer** : Vérifier que le litige est toujours visible
4. **En tant que Buyer** : Archiver également

**Résultats Attendus** :
- ✅ Après archivage Seller : `archived_by_seller: true`, litige invisible pour seller
- ✅ Litige toujours visible pour buyer
- ✅ Après archivage Buyer : `archived_by_buyer: true`, litige invisible pour buyer
- ✅ Admin voit toujours le litige (jamais archivé)

**Vérifications DB** :
```sql
SELECT 
  id,
  status,
  archived_by_seller,
  archived_by_buyer,
  seller_archived_at,
  buyer_archived_at
FROM disputes
WHERE id = 'VOTRE_DISPUTE_ID';
```

---

## 🔍 Tests de Sécurité RLS

### Vérifier l'isolation des messages

```sql
-- En tant que Seller, ne doit PAS voir les messages Admin ↔ Buyer
SET ROLE authenticated;
SET request.jwt.claims = '{"sub": "SELLER_USER_ID"}';

SELECT m.* 
FROM messages m
JOIN conversations c ON c.id = m.conversation_id
WHERE c.conversation_type = 'admin_buyer_dispute';
-- Devrait retourner 0 lignes

RESET ROLE;
```

### Vérifier le blocage post-escalade

```sql
-- Tenter d'insérer un message public après escalade (devrait échouer)
INSERT INTO messages (conversation_id, sender_id, message, message_type)
VALUES (
  'CONVERSATION_ID_TRANSACTION',
  'SELLER_USER_ID',
  'Test message après escalade',
  'text'
);
-- Devrait échouer avec : "Public two-party messages are disabled after escalation"
```

---

## ✅ Checklist Finale

- [ ] Test 1 : Création litige ✅
- [ ] Test 2 : Messages pre-escalation ✅
- [ ] Test 3 : Escalade manuelle ✅
- [ ] Test 4 : Isolation conversations admin ✅
- [ ] Test 5 : Proposition officielle admin ✅
- [ ] Test 6 : Escalade automatique ✅
- [ ] Test 7 : Archivage individuel ✅
- [ ] Sécurité RLS validée ✅
- [ ] Compteurs non lus corrects ✅
- [ ] Notifications reçues ✅
- [ ] Activity logs créés ✅

---

## 🚨 Problèmes Connus à Surveiller

1. **Messages non visibles** → Vérifier RLS policies sur `messages`
2. **Compteurs non lus incorrects** → Vérifier `conversation_reads` et `last_read_at`
3. **Notifications manquantes** → Vérifier edge function `send-notifications`
4. **Conversations admin non créées** → Vérifier RPC `create_escalated_dispute_conversations`

---

## 📊 Requêtes de Debug Utiles

```sql
-- Vue d'ensemble d'un litige
SELECT 
  d.id as dispute_id,
  d.status,
  d.escalated_at,
  t.title as transaction_title,
  COUNT(DISTINCT c.id) as conversation_count,
  COUNT(DISTINCT m.id) as message_count
FROM disputes d
JOIN transactions t ON t.id = d.transaction_id
LEFT JOIN conversations c ON c.dispute_id = d.id
LEFT JOIN messages m ON m.conversation_id = c.id
WHERE d.id = 'VOTRE_DISPUTE_ID'
GROUP BY d.id, d.status, d.escalated_at, t.title;

-- Détail des conversations d'un litige
SELECT 
  c.id,
  c.conversation_type,
  c.status,
  COUNT(m.id) as message_count
FROM conversations c
LEFT JOIN messages m ON m.conversation_id = c.id
WHERE c.dispute_id = 'VOTRE_DISPUTE_ID'
GROUP BY c.id, c.conversation_type, c.status;
```
