# 🔔 Configuration du Webhook Stripe

## Vue d'ensemble

Le webhook Stripe est essentiel pour synchroniser les paiements, remboursements et statuts de comptes Stripe Connect en temps réel avec votre application.

## Fonctionnalités du Webhook

Le webhook gère automatiquement:

1. **payment_intent.succeeded** - Paiement réussi
   - Met à jour la transaction à "paid"
   - Définit la deadline de validation (72h)
   - Enregistre le mode de paiement (carte/virement)
   - Log l'activité pour les deux parties

2. **payment_intent.payment_failed** - Échec de paiement
   - Met à jour la transaction à "expired"
   - Log l'échec avec raison

3. **charge.refunded** - Remboursement
   - Met à jour le statut de remboursement
   - Marque les fonds comme libérés

4. **account.updated** - Mise à jour compte Stripe Connect
   - Synchronise le statut du compte (charges_enabled, payouts_enabled)
   - Met à jour onboarding_completed

## 🔐 Sécurité

✅ **Idempotence intégrée**
- Chaque événement est enregistré dans `webhook_events`
- Les événements dupliqués sont détectés et ignorés automatiquement
- Prévient les double-paiements et incohérences

✅ **Vérification de signature**
- Toutes les requêtes sont vérifiées avec `STRIPE_WEBHOOK_SECRET`
- Protection contre les attaques de rejeu

✅ **Validation stricte**
- Vérifie que la transaction existe
- Empêche les mises à jour invalides (ex: passer de "paid" à "paid")

## 📋 Configuration dans Stripe Dashboard

### 1. Accéder aux webhooks

1. Connectez-vous à [Stripe Dashboard](https://dashboard.stripe.com)
2. Allez dans **Développeurs** > **Webhooks**
3. Cliquez sur **Ajouter un endpoint**

### 2. Configurer l'URL du webhook

**URL Production:**
```
https://slthyxqruhfuyfmextwr.supabase.co/functions/v1/stripe-webhook
```

**URL Test (mode test Stripe):**
```
https://slthyxqruhfuyfmextwr.supabase.co/functions/v1/stripe-webhook
```

### 3. Sélectionner les événements

Cochez les événements suivants:

- ✅ `payment_intent.succeeded`
- ✅ `payment_intent.payment_failed`
- ✅ `charge.refunded`
- ✅ `account.updated`

### 4. Récupérer le Signing Secret

1. Une fois le webhook créé, cliquez dessus
2. Dans la section **Signing secret**, cliquez sur **Reveal**
3. Copiez la valeur (format: `whsec_...`)

### 5. Configurer le secret dans Supabase

Le secret `STRIPE_WEBHOOK_SECRET` doit être configuré dans les secrets Supabase:

1. Allez dans Supabase Dashboard
2. **Settings** > **Edge Functions** > **Secrets**
3. Ajoutez/mettez à jour `STRIPE_WEBHOOK_SECRET` avec la valeur copiée

## 🧪 Tester le Webhook

### Test avec Stripe CLI (Développement local)

```bash
# Installer Stripe CLI
brew install stripe/stripe-brew/stripe

# Se connecter
stripe login

# Écouter les webhooks localement
stripe listen --forward-to https://slthyxqruhfuyfmextwr.supabase.co/functions/v1/stripe-webhook

# Déclencher un événement test
stripe trigger payment_intent.succeeded
```

### Test en production

1. Dans Stripe Dashboard, allez à votre webhook
2. Cliquez sur l'onglet **Envoyer un événement test**
3. Sélectionnez `payment_intent.succeeded`
4. Modifiez le JSON pour inclure vos IDs de test:
```json
{
  "metadata": {
    "transaction_id": "UUID-de-votre-transaction",
    "buyer_id": "UUID-du-buyer"
  }
}
```
5. Cliquez sur **Envoyer l'événement test**

## 📊 Monitoring

### Vérifier les événements reçus

**Dans Stripe Dashboard:**
- **Développeurs** > **Webhooks** > Votre webhook
- Onglet **Tentatives récentes**
- Vérifiez les codes de réponse (200 = succès)

**Dans Supabase:**
```sql
-- Voir les événements webhook traités
SELECT * FROM webhook_events 
ORDER BY created_at DESC 
LIMIT 10;

-- Voir les événements par type
SELECT event_type, COUNT(*) 
FROM webhook_events 
GROUP BY event_type;
```

### Logs de debug

Les logs sont disponibles dans Supabase Dashboard:
- **Edge Functions** > **stripe-webhook** > **Logs**

Format des logs:
```
[INFO] Stripe webhook event received: payment_intent.succeeded
[INFO] Payment succeeded - transactionId: abc-123
[INFO] Transaction updated to paid - transactionId: abc-123
```

## 🔄 Maintenance Automatique

Un cron job nettoie automatiquement les anciens événements webhook:

```sql
-- Exécuté quotidiennement via cleanup-webhook-events
DELETE FROM webhook_events 
WHERE created_at < NOW() - INTERVAL '90 days';
```

## ⚠️ Problèmes Courants

### Webhook retourne 500

**Causes possibles:**
- `STRIPE_WEBHOOK_SECRET` manquant ou invalide
- Signature Stripe invalide
- Transaction introuvable dans la base de données

**Solution:**
1. Vérifier que le secret est bien configuré
2. Vérifier les logs Edge Function
3. Tester avec Stripe CLI

### Événements dupliqués

**Pas de problème!** L'idempotence est gérée automatiquement:
- Chaque événement est enregistré dans `webhook_events`
- Les doublons retournent `200 OK` avec `{ idempotent: true }`

### Transaction pas mise à jour

**Vérifier:**
1. Le `metadata.transaction_id` est présent dans le PaymentIntent
2. La transaction existe dans la base de données
3. Le statut de la transaction permet la mise à jour

## 📝 Checklist de Configuration

- [ ] Webhook créé dans Stripe Dashboard
- [ ] URL configurée: `https://slthyxqruhfuyfmextwr.supabase.co/functions/v1/stripe-webhook`
- [ ] Événements sélectionnés: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `account.updated`
- [ ] `STRIPE_WEBHOOK_SECRET` configuré dans Supabase
- [ ] Test réussi avec Stripe Dashboard ou CLI
- [ ] Logs vérifiés (200 OK dans Stripe Dashboard)
- [ ] Événement test visible dans `webhook_events`

## 🚀 Prochaines Étapes

1. Configurer le webhook Stripe (ce guide)
2. Mettre à jour `payment-utils.ts` pour utiliser la bonne version API
3. Tester le flux de paiement complet
4. Monitorer les webhooks pendant 24h

---

**Date de création**: 2025-01-19  
**Dernière mise à jour**: 2025-01-19  
**Responsable**: System Architect
