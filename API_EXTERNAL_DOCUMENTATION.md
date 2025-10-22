# 📡 RivvLock - Documentation API Externe

## 🔐 Authentification

Toutes les requêtes authentifiées nécessitent un token JWT Supabase dans le header :
```
Authorization: Bearer <votre_token_jwt>
```

Pour obtenir un token :
```typescript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
```

---

## 📋 Endpoints Publics (Sans Authentification)

### 1. Récupérer un devis par token
**Endpoint :** `GET /functions/v1/get-quote-by-token`  
**Auth :** ❌ Non requise (accès par token sécurisé)

**Paramètres :**
- `token` (string, required) : Token sécurisé du devis

**Exemple de requête :**
```typescript
const response = await fetch(
  `https://slthyxqruhfuyfmextwr.supabase.co/functions/v1/get-quote-by-token?token=abc123xyz`,
  { method: 'GET' }
);
const data = await response.json();
```

**Exemple de réponse :**
```json
{
  "id": "uuid",
  "title": "Devis Exemple",
  "total_amount": 1000,
  "currency": "EUR",
  "status": "pending",
  "seller_id": "uuid",
  "client_email": "client@example.com",
  "valid_until": "2024-12-31T23:59:59Z"
}
```

---

### 2. Récupérer une transaction par token
**Endpoint :** `GET /functions/v1/get-transaction-by-token`  
**Auth :** ❌ Non requise

**Paramètres :**
- `token` (string, required) : Token sécurisé de la transaction

**Exemple de réponse :**
```json
{
  "id": "uuid",
  "title": "Prestation Web",
  "description": "Développement site vitrine",
  "price": 2500,
  "currency": "EUR",
  "status": "awaiting_payment",
  "seller_display_name": "John Doe",
  "buyer_display_name": "Jane Smith",
  "service_date": "2024-06-15T10:00:00Z",
  "payment_deadline": "2024-06-01T23:59:59Z",
  "shared_link_expires_at": "2024-06-10T23:59:59Z"
}
```

---

## 🔒 Endpoints Authentifiés

### 3. Créer une transaction
**Endpoint :** `POST /functions/v1/create-transaction`  
**Auth :** ✅ Requise

**Body :**
```json
{
  "title": "Prestation Web",
  "description": "Développement site vitrine",
  "price": 2500,
  "currency": "EUR",
  "buyer_email": "buyer@example.com",
  "service_date": "2024-06-15T10:00:00Z",
  "payment_deadline": "2024-06-01T23:59:59Z",
  "fee_ratio_buyer": 50
}
```

**Réponse :**
```json
{
  "transaction": {
    "id": "uuid",
    "title": "Prestation Web",
    "status": "awaiting_payment",
    "shared_link_token": "secure_token_here"
  }
}
```

---

### 4. Créer un devis
**Endpoint :** `POST /functions/v1/create-quote`  
**Auth :** ✅ Requise

**Body :**
```json
{
  "title": "Devis Développement",
  "description": "Site e-commerce complet",
  "items": [
    {
      "description": "Design UI/UX",
      "quantity": 1,
      "unit_price": 1500
    },
    {
      "description": "Intégration",
      "quantity": 20,
      "unit_price": 80
    }
  ],
  "client_email": "client@example.com",
  "valid_until": "2024-12-31T23:59:59Z",
  "service_date": "2024-07-01T00:00:00Z",
  "tax_rate": 20,
  "fee_ratio_client": 50
}
```

**Réponse :**
```json
{
  "id": "uuid",
  "title": "Devis Développement",
  "total_amount": 3100,
  "subtotal": 3100,
  "tax_amount": 620,
  "status": "pending",
  "quote_token": "secure_quote_token"
}
```

---

### 5. Créer un litige
**Endpoint :** `POST /functions/v1/create-dispute`  
**Auth :** ✅ Requise

**Body :**
```json
{
  "transaction_id": "uuid",
  "dispute_type": "service_not_delivered",
  "dispute_message": "Le service n'a pas été livré dans les délais convenus"
}
```

**Réponse :**
```json
{
  "dispute": {
    "id": "uuid",
    "transaction_id": "uuid",
    "status": "open",
    "dispute_deadline": "2024-06-20T23:59:59Z",
    "conversation_id": "uuid"
  }
}
```

---

### 6. Rejoindre une transaction (Buyer)
**Endpoint :** `POST /functions/v1/join-transaction`  
**Auth :** ✅ Requise

**Body :**
```json
{
  "transaction_id": "uuid",
  "token": "shared_link_token"
}
```

**Réponse :**
```json
{
  "success": true,
  "message": "Successfully joined transaction"
}
```

---

### 7. Marquer un paiement comme autorisé
**Endpoint :** `POST /functions/v1/mark-payment-authorized`  
**Auth :** ✅ Requise

**Body :**
```json
{
  "transaction_id": "uuid"
}
```

**Réponse :**
```json
{
  "success": true,
  "transaction": {
    "id": "uuid",
    "status": "paid"
  }
}
```

---

### 8. Libérer les fonds (Admin/Seller après validation)
**Endpoint :** `POST /functions/v1/release-funds`  
**Auth :** ✅ Requise

**Body :**
```json
{
  "transaction_id": "uuid"
}
```

**Réponse :**
```json
{
  "success": true,
  "transfer_id": "stripe_transfer_id"
}
```

---

## 📊 Endpoints de Reporting

### 9. Générer un rapport annuel
**Endpoint :** `POST /functions/v1/generate-annual-report`  
**Auth :** ✅ Requise

**Body :**
```json
{
  "year": 2024
}
```

**Réponse :**
```json
{
  "report": {
    "year": 2024,
    "total_transactions": 45,
    "total_volume": 125000,
    "total_fees_paid": 6250,
    "transactions": [...]
  }
}
```

---

### 10. Récupérer les transactions enrichies
**Endpoint :** `POST /functions/v1/get-transactions-enriched`  
**Auth :** ✅ Requise

**Body :**
```json
{
  "year": 2024,
  "month": 6,
  "status": "paid"
}
```

**Réponse :**
```json
{
  "transactions": [
    {
      "id": "uuid",
      "title": "Prestation",
      "status": "paid",
      "price": 1000,
      "counterparty_name": "John Doe",
      "has_unread_messages": false,
      "has_active_dispute": false
    }
  ]
}
```

---

## 🔔 Webhooks Stripe

**Endpoint :** `POST /functions/v1/stripe-webhook`  
**Auth :** ❌ Non requise (vérification signature Stripe)

**Events gérés :**
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `account.updated`
- `payout.paid`
- `payout.failed`

**Configuration :**
1. Créer un webhook dans Stripe Dashboard
2. URL : `https://slthyxqruhfuyfmextwr.supabase.co/functions/v1/stripe-webhook`
3. Ajouter le secret dans les variables d'environnement : `STRIPE_WEBHOOK_SECRET`

---

## ⚠️ Codes d'Erreur

| Code | Message | Description |
|------|---------|-------------|
| 400 | Bad Request | Paramètres manquants ou invalides |
| 401 | Unauthorized | Token JWT manquant ou invalide |
| 403 | Forbidden | Accès non autorisé à cette ressource |
| 404 | Not Found | Ressource introuvable |
| 409 | Conflict | Conflit (ex: transaction déjà rejointe) |
| 500 | Internal Server Error | Erreur serveur |

**Format d'erreur standard :**
```json
{
  "error": {
    "message": "Transaction not found",
    "code": "TRANSACTION_NOT_FOUND",
    "details": {}
  }
}
```

---

## 🔄 Rate Limiting

- **Limite générale :** 100 requêtes / minute / utilisateur
- **Stripe webhooks :** Pas de limite (signature vérifiée)
- **Endpoints publics :** 20 requêtes / minute / IP

---

## 📞 Support

- **Documentation complète :** [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
- **Architecture :** [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Troubleshooting :** [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

**Dernière mise à jour :** 2025-10-21  
**Version API :** 1.0
