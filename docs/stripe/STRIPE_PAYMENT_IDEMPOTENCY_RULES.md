# 🔒 Règles d'Idempotence Stripe - CRITIQUES

**⚠️ CES RÈGLES SONT NON-NÉGOCIABLES ⚠️**

## Problème Historique Résolu

### Bug du 19 Octobre 2025
**Symptôme** : Edge Function `accept-proposal` retournait une erreur 500 côté client alors que les transferts Stripe étaient effectués avec succès.

**Cause racine** : Absence d'idempotence sur les opérations Stripe.
- Les transferts Stripe étaient créés à chaque appel
- En cas d'erreur après le transfert (ex: mise à jour DB), un retry créait un doublon
- L'utilisateur voyait une erreur alors que l'argent était transféré

**Impact** : Perte de confiance utilisateur, risques financiers (doubles transferts).

---

## 🚨 Règles Obligatoires pour Toutes les Opérations Stripe

### 1. TOUJOURS Implémenter l'Idempotence

**Pour TOUS les appels Stripe modifiant des données financières** :
- `stripe.transfers.create()`
- `stripe.refunds.create()`
- `stripe.paymentIntents.create()`
- `stripe.charges.capture()`

**Pattern obligatoire** :

```typescript
// ✅ CORRECT - Vérifier AVANT de créer
const existingTransfers = await stripe.transfers.list({
  transfer_group: uniqueGroupId,
  limit: 100
});

const alreadyProcessed = existingTransfers.data.some(t => 
  t.metadata?.type === 'specific_operation_type' &&
  t.destination === destinationAccountId
);

if (alreadyProcessed) {
  logStep('Transfer already exists, skipping Stripe operation');
  // Continue avec la logique métier sans erreur
} else {
  await stripe.transfers.create({
    // ...
    transfer_group: uniqueGroupId,
    metadata: {
      type: 'specific_operation_type',
      transaction_id: txId,
      dispute_id: disputeId
    }
  });
}
```

**❌ INTERDIT - Créer sans vérifier** :
```typescript
// Ne JAMAIS faire ça
await stripe.transfers.create({ ... });
```

---

### 2. Utiliser des Métadonnées Descriptives

**Chaque opération Stripe DOIT avoir** :
- `transfer_group` : Identifiant unique de regroupement (ex: `dispute_${disputeId}`)
- `metadata.type` : Type d'opération (ex: `partial_refund_seller_share`, `no_refund_release`)
- `metadata.transaction_id` : ID transaction RivvLock
- `metadata.dispute_id` : ID litige (si applicable)

```typescript
// ✅ CORRECT
await stripe.transfers.create({
  transfer_group: `dispute_${disputeId}`,
  metadata: {
    type: 'partial_refund_seller_share',
    transaction_id: transactionId,
    dispute_id: disputeId,
    proposal_id: proposalId
  }
});
```

---

### 3. Gérer les Succès Partiels

**Si une opération Stripe réussit mais la mise à jour DB échoue** :

```typescript
// ✅ CORRECT - Retourner 200 avec warnings
return successResponse({
  partial_success: true,
  warnings: [
    'Stripe operation completed successfully',
    'Some database updates failed - please contact support'
  ],
  stripe_operation: 'completed',
  database_updates: 'failed'
});

// ❌ INTERDIT - Retourner 500
throw new Error('Database update failed'); // Stripe déjà effectué !
```

---

### 4. Frontend : Gérer les `partial_success`

**Dans les hooks React** :

```typescript
// ✅ CORRECT
const result = await acceptProposal.mutateAsync(proposalId);

if (result.partial) {
  toast.success('Paiement effectué', {
    description: result.message,
    duration: 6000 // Plus long pour que l'utilisateur lise
  });
} else {
  toast.success('Opération réussie');
}
```

---

## 📋 Checklist Avant Déploiement

### Pour Chaque Edge Function Stripe

- [ ] **Idempotence** : Vérifie si l'opération existe déjà avant de créer
- [ ] **Métadonnées complètes** : `transfer_group`, `type`, `transaction_id`, etc.
- [ ] **Gestion erreurs** : Distinction entre erreurs Stripe vs erreurs post-Stripe
- [ ] **Succès partiels** : Retour 200 avec `partial_success` si Stripe OK mais DB KO
- [ ] **Logging** : `logStep()` à chaque étape critique
- [ ] **Frontend** : Gestion des `partial_success` dans le hook
- [ ] **Tests manuels** : Tester un double-clic / double appel

---

## 🔍 Tests de Non-Régression

**Après modification d'une edge function de paiement** :

1. **Test double-clic** :
   - Accepter une proposition
   - Pendant le chargement, réouvrir DevTools et refaire l'appel
   - ✅ Vérifier : Pas de double transfert Stripe

2. **Test erreur post-Stripe** :
   - Forcer une erreur DB après le transfert (ex: constraint violation)
   - ✅ Vérifier : Message succès partiel côté client
   - ✅ Vérifier : Transfert Stripe existant dans Stripe Dashboard

3. **Test logs** :
   - Consulter les logs Edge Function
   - ✅ Vérifier : `logStep` clairement visible
   - ✅ Vérifier : Pas d'erreurs 500 si Stripe OK

---

## 📚 Fonctions Concernées

**Edge Functions avec opérations Stripe critiques** :
- ✅ `accept-proposal` (CORRIGÉ le 19/10/2025)
- `process-dispute`
- `release-funds`
- `create-payment-intent`
- `process-automatic-transfer`
- `stripe-webhook` (déjà idempotent via `idempotency_key`)

**Action requise** : Auditer TOUTES ces fonctions pour s'assurer qu'elles respectent ces règles.

---

## 🎯 Philosophie

> **"Une opération Stripe réussie est DÉFINITIVE. Le code doit refléter cette réalité."**

Si Stripe dit "OK", on ne peut pas revenir en arrière côté Stripe sans un appel explicite (refund, reversal).
Le code doit donc :
1. ✅ Vérifier AVANT de créer
2. ✅ Accepter qu'une opération Stripe OK = succès partiel minimum
3. ✅ Informer l'utilisateur différemment selon le niveau de succès

---

**Version** : 1.0.0  
**Date** : 19 octobre 2025  
**Auteur** : Documentation post-incident  
**Statut** : 🔴 CRITIQUE - RÈGLES NON-NÉGOCIABLES
