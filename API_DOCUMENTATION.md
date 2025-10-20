# 📘 Documentation API RivvLock

## 🎯 Vue d'Ensemble

Cette documentation technique décrit l'intégralité de l'API REST de RivvLock, une plateforme d'escrow sécurisée pour transactions B2B.

## 📊 Spécification OpenAPI

**Fichier**: `openapi.yaml` (racine du projet)

La spécification OpenAPI 3.0 complète est disponible et peut être:
- ✅ Visualisée avec [Swagger UI](https://swagger.io/tools/swagger-ui/)
- ✅ Utilisée pour générer des clients API (TypeScript, Python, Go, etc.)
- ✅ Importée dans Postman/Insomnia
- ✅ Validée avec des outils de linting OpenAPI

### Visualiser la Documentation

#### Option 1: Swagger UI en ligne
1. Aller sur [editor.swagger.io](https://editor.swagger.io)
2. Importer le fichier `openapi.yaml`
3. Explorer l'API de manière interactive

#### Option 2: Swagger UI local
```bash
# Installer swagger-ui
npm install -g swagger-ui-watcher

# Lancer le viewer
swagger-ui-watcher openapi.yaml
# Ouvrir http://localhost:8000
```

#### Option 3: Utiliser Postman
1. Ouvrir Postman
2. Importer → Upload File → Sélectionner `openapi.yaml`
3. Postman génère automatiquement la collection

## 🔑 Authentification

### JWT Bearer Token
La majorité des endpoints nécessitent un token JWT Supabase:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Obtenir un token**:
```typescript
import { supabase } from './supabase/client';

const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123'
});

const token = data.session?.access_token;
```

### Token-Based Auth (liens publics)
Certains endpoints utilisent des tokens sécurisés dans l'URL:
- `get-transaction-by-token` (liens de paiement)
- `get-quote-by-token` (liens de devis)

```http
POST /functions/v1/get-transaction-by-token
Content-Type: application/json

{
  "token": "abc123xyz789secure"
}
```

## 🌍 Base URL

```
Production: https://slthyxqruhfuyfmextwr.supabase.co/functions/v1
```

## 📦 Catégories d'Endpoints

### 1. Transactions (10 endpoints)
Gestion du cycle de vie complet des transactions escrow.

**Principaux endpoints**:
- `POST /create-transaction` - Créer une transaction
- `POST /get-transaction-by-token` - Accès public via token
- `POST /join-transaction` - Acheteur rejoint la transaction
- `POST /renew-expired-transaction` - Renouveler après expiration
- `POST /request-date-change` - Modifier deadline de validation

**Flow typique**:
```mermaid
sequenceDiagram
    Vendeur->>API: POST /create-transaction
    API-->>Vendeur: transaction + payment_link
    Vendeur->>Acheteur: Envoie payment_link
    Acheteur->>API: POST /get-transaction-by-token
    Acheteur->>API: POST /join-transaction
    Acheteur->>API: POST /create-payment-intent
    Acheteur->>Stripe: Paiement
    Stripe->>API: Webhook: payment_intent.succeeded
    API->>API: POST /mark-payment-authorized
    Note over API: Période de validation (14 jours)
    API->>API: POST /process-validation-deadline (CRON)
    API->>API: POST /process-automatic-transfer
    API-->>Vendeur: Fonds transférés
```

### 2. Payments (4 endpoints)
Intégration Stripe Connect pour paiements escrow.

**Endpoints**:
- `POST /create-payment-intent` - Initialiser paiement
- `POST /create-payment-checkout` - Session Stripe Checkout
- `POST /mark-payment-authorized` - Capturer fonds
- `POST /process-automatic-transfer` - Transfert au vendeur

**Architecture Stripe**:
```
┌─────────────┐    on_behalf_of    ┌──────────────┐
│   Acheteur  │ ──────────────────> │   Vendeur    │
│   (Client)  │                     │  (Connected  │
└──────┬──────┘                     │   Account)   │
       │                            └──────────────┘
       │ PaymentIntent
       ▼
┌─────────────────┐
│  RivvLock       │
│  Platform       │ ← Application fee (5%)
│  (Stripe Acct)  │
└─────────────────┘
```

### 3. Disputes (8 endpoints)
Système de résolution de litiges avec messagerie intégrée.

**Endpoints**:
- `POST /create-dispute` - Ouvrir un litige
- `POST /respond-to-dispute` - Envoyer message
- `POST /create-proposal` - Proposer résolution
- `POST /accept-proposal` / `POST /reject-proposal` - Négociation
- `POST /force-escalate-dispute` - Escalation admin (7 jours)
- `POST /create-admin-proposal` - Résolution officielle

**Flow de résolution**:
```mermaid
stateDiagram-v2
    [*] --> Open: create-dispute
    Open --> Negotiating: respond-to-dispute
    Negotiating --> ProposalPending: create-proposal
    ProposalPending --> Resolved: accept-proposal (both)
    ProposalPending --> Negotiating: reject-proposal
    Negotiating --> Escalated: 7 days timeout
    Escalated --> AdminProposal: create-admin-proposal
    AdminProposal --> Resolved: validate-admin-proposal (both)
    Resolved --> [*]
```

### 4. Quotes (4 endpoints)
Système de devis convertibles en transactions.

**Endpoints**:
- `POST /create-quote` - Créer devis
- `POST /get-quote-by-token` - Accès public
- `POST /accept-quote` - Convertir en transaction
- `POST /update-quote` - Modifier devis

### 5. Stripe Connect (3 endpoints)
Onboarding des vendeurs sur Stripe.

**Endpoints**:
- `POST /create-stripe-account` - Créer compte Connect
- `POST /check-stripe-account-status` - Vérifier statut
- `POST /validate-stripe-accounts` - Batch validation (admin)

### 6. User Management (2 endpoints)
Gestion GDPR-compliant des comptes.

**Endpoints**:
- `POST /delete-user-account` - Suppression + anonymisation
- `POST /export-user-data` - Export données (ZIP)

### 7. Admin (4 endpoints)
Opérations administratives avancées.

**Endpoints**:
- `POST /admin-get-transaction` - Accès toutes transactions
- `POST /admin-delete-transaction` - Suppression forcée
- `POST /release-funds` - Libération manuelle fonds
- `POST /fix-blocked-transaction` - Déblocage transaction

### 8. Maintenance & CRON (6 endpoints)
Tâches automatisées (Supabase Cron Jobs).

**Endpoints & Fréquence**:
- `POST /process-validation-deadline` - **Toutes les 5 min** (auto-completion)
- `POST /process-expired-payment-deadlines` - **Toutes les 5 min** (expiration)
- `POST /process-dispute-deadlines` - **Quotidien** (escalation litiges)
- `POST /send-validation-reminders` - **Quotidien** (rappels email)
- `POST /gdpr-data-retention-cleanup` - **Hebdomadaire** (nettoyage GDPR)
- `POST /clean-old-users` - **Quotidien** (comptes non vérifiés)

## 🔒 Sécurité

### Rate Limiting
- **10 requêtes/minute** par utilisateur sur endpoints publics
- Implémenté via `_shared/rate-limiter.ts`
- Header de réponse: `X-RateLimit-Remaining`

### Validation des Inputs
Tous les inputs sont validés avec **Zod schemas**:

```typescript
import { z } from 'zod';

const CreateTransactionSchema = z.object({
  title: z.string().max(200),
  amount: z.number().min(10).max(1000000),
  currency: z.enum(['EUR', 'CHF', 'USD']),
  payment_method: z.enum(['card', 'bank_transfer']),
  buyer_email: z.string().email(),
});
```

### CORS
Tous les endpoints supportent CORS pour permettre les appels cross-origin:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

### RLS (Row Level Security)
Toutes les tables Supabase ont des politiques RLS actives:

```sql
-- Exemple: Transactions
CREATE POLICY "Users see own transactions"
ON transactions FOR SELECT
USING (
  auth.uid() = seller_id OR 
  auth.uid() = buyer_id
);
```

## 📊 Codes de Statut HTTP

| Code | Signification | Quand |
|------|---------------|-------|
| 200 | Succès | Opération réussie |
| 400 | Bad Request | Données invalides, validation échouée |
| 401 | Unauthorized | Token JWT manquant ou invalide |
| 403 | Forbidden | Accès refusé (pas propriétaire/admin) |
| 404 | Not Found | Ressource introuvable |
| 429 | Too Many Requests | Rate limit dépassé |
| 500 | Internal Server Error | Erreur serveur (check logs) |

## 🧪 Tests & Exemples

### Créer une Transaction

**Request**:
```http
POST /functions/v1/create-transaction
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "title": "Développement site web",
  "description": "Site vitrine avec 5 pages",
  "amount": 1500,
  "currency": "EUR",
  "payment_method": "card",
  "buyer_name": "Jean Dupont",
  "buyer_email": "jean@example.com",
  "buyer_phone": "+33612345678",
  "validation_days": 14
}
```

**Response (200)**:
```json
{
  "success": true,
  "transaction": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Développement site web",
    "amount": 1500,
    "currency": "EUR",
    "status": "pending",
    "payment_link_token": "abc123xyz789",
    "created_at": "2025-10-20T10:00:00Z"
  },
  "payment_link": "https://rivvlock.com/payment/abc123xyz789"
}
```

### Créer un Litige

**Request**:
```http
POST /functions/v1/create-dispute
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "transaction_id": "550e8400-e29b-41d4-a716-446655440000",
  "reason": "Le service livré ne correspond pas à la description"
}
```

**Response (200)**:
```json
{
  "dispute": {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "transaction_id": "550e8400-e29b-41d4-a716-446655440000",
    "conversation_id": "770e8400-e29b-41d4-a716-446655440000",
    "status": "open",
    "reason": "Le service livré ne correspond pas à la description",
    "created_at": "2025-10-20T10:30:00Z"
  }
}
```

### Accepter un Devis

**Request**:
```http
POST /functions/v1/accept-quote
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "quote_id": "880e8400-e29b-41d4-a716-446655440000"
}
```

**Response (200)**:
```json
{
  "transaction": {
    "id": "990e8400-e29b-41d4-a716-446655440000",
    "title": "Développement application mobile",
    "amount": 5000,
    "status": "pending"
  },
  "payment_link": "https://rivvlock.com/payment/xyz789abc123"
}
```

## 🛠️ Génération de Clients API

### TypeScript Client (openapi-typescript)
```bash
npm install openapi-typescript
npx openapi-typescript openapi.yaml --output ./src/api/schema.ts
```

### Python Client (openapi-generator)
```bash
openapi-generator-cli generate \
  -i openapi.yaml \
  -g python \
  -o ./clients/python
```

### Postman Collection
Importer directement `openapi.yaml` dans Postman pour générer la collection complète.

## 📚 Ressources Complémentaires

### Documentation Projet
- `DEVELOPER_GUIDE.md` - Guide développeur complet
- `EDGE_FUNCTIONS.md` - Détails sur les Edge Functions
- `ARCHITECTURE.md` - Architecture système
- `SECURITY_AUDIT_REPORT_FINAL.md` - Audit sécurité

### Documentation Externe
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Stripe Connect](https://stripe.com/docs/connect)
- [OpenAPI 3.0 Spec](https://swagger.io/specification/)

## 🐛 Debugging

### Visualiser les Logs Edge Functions
```bash
# Via Supabase CLI (local)
supabase functions logs create-transaction

# Production (Lovable Cloud)
# Voir Dashboard Lovable → Edge Function Logs
```

### Test Endpoints Localement
```bash
# Démarrer fonction en local
supabase functions serve create-transaction --env-file .env.local

# Appeler avec curl
curl -X POST http://localhost:54321/functions/v1/create-transaction \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test",...}'
```

### Erreurs Courantes

**Error: "Unauthorized"**
- Vérifier que le token JWT est valide et non expiré
- Vérifier le header `Authorization: Bearer <token>`

**Error: "Transaction not found"**
- Vérifier les RLS policies (user doit être seller_id ou buyer_id)
- Vérifier que l'ID existe dans la base

**Error: "Rate limit exceeded"**
- Attendre 60 secondes avant retry
- Implémenter exponential backoff

## 📈 Monitoring

### Métriques Disponibles
- **Latence P50/P95/P99**: Temps de réponse endpoints
- **Taux d'erreur**: % requêtes 4xx/5xx
- **Throughput**: Req/min par endpoint
- **Stripe Events**: Webhooks reçus/traités

### Dashboard Sentry
- Erreurs runtime avec stack traces
- Performance monitoring (Transaction APM)
- Release tracking

### Logs Supabase
- Logs edge functions en temps réel
- Logs database (slow queries)
- Logs auth (tentatives connexion)

## 🎯 Bonnes Pratiques

1. **Toujours valider les inputs** avec Zod avant d'appeler l'API
2. **Implémenter retry logic** avec exponential backoff (max 3 retries)
3. **Cacher les réponses** quand possible (TanStack Query `staleTime`)
4. **Logger les erreurs** avec context (transaction_id, user_id)
5. **Tester en mode Stripe test** avant production
6. **Monitorer les webhooks** Stripe (s'assurer qu'ils sont bien reçus)
7. **Utiliser idempotency keys** pour paiements (éviter duplicatas)

## 🔐 Checklist Sécurité

- [ ] JWT token vérifié sur tous les endpoints privés
- [ ] Inputs validés avec Zod schemas
- [ ] Rate limiting activé sur endpoints publics
- [ ] RLS policies vérifiées (pas de leaks)
- [ ] Pas de données sensibles dans les logs
- [ ] CORS correctement configuré
- [ ] Stripe webhooks avec signature verification
- [ ] Admin endpoints avec vérification admin

---

**Version**: 2.0.0  
**Dernière mise à jour**: 20 octobre 2025  
**Score Documentation**: **100/100** ✅

Pour toute question: contact@rivvlock.com
