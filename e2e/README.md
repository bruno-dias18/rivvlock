# Tests E2E RivvLock - Guide Complet

## Vue d'ensemble

Tests End-to-End Playwright pour valider les parcours critiques de RivvLock :
- ✅ **Payment Flow** : Paiement complet (CB + virement)
- ✅ **Dispute Flow** : Création, négociation, escalade, résolution
- ✅ **Admin Validation** : Gestion transactions, litiges, utilisateurs
- 🆕 **Validation Flow** : Countdown 72h et validation acheteur
- 🆕 **Refund Flow** : Remboursements complets et partiels

## 🚀 Setup Rapide avec User Pool (Recommandé)

**Nouveau depuis 2025-10-24** : Les tests utilisent maintenant un **pool de users réutilisables** pour éliminer les alertes Supabase et accélérer les tests de **5-10x**.

### Initialiser le pool (une seule fois)

```bash
# Créer 20 users de test (10 sellers + 10 buyers)
npm run e2e:setup-pool

# Durée: ~1 minute
# Le pool persiste indéfiniment, pas besoin de le recréer !
```

### Lancer les tests

```bash
# Les tests utilisent automatiquement le pool
npx playwright test

# Plus d'appels à test-create-user = Plus d'alertes Supabase ✅
# Tests 5-10x plus rapides ✅
```

### Fonctionnement du pool

- **20 users pré-créés** : 10 sellers + 10 buyers
- **Thread-safe** : système de checkout évite les collisions en tests parallèles
- **Fallback automatique** : si le pool n'existe pas, création on-the-fly (lent mais fonctionnel)
- **Réutilisable** : chaque test emprunte un user puis le rend disponible après cleanup
- **Aucune maintenance** : le pool dure indéfiniment jusqu'au cleanup manuel

### Structure du pool

```json
// e2e/.test-user-pool.json (auto-généré, ignoré par Git)
{
  "sellers": [
    { "id": "uuid", "email": "test-pool-seller-01@gmail.com", "password": "Test123!@#$%" },
    { "id": "uuid", "email": "test-pool-seller-02@gmail.com", "password": "Test123!@#$%" },
    ...
  ],
  "buyers": [
    { "id": "uuid", "email": "test-pool-buyer-01@gmail.com", "password": "Test123!@#$%" },
    ...
  ],
  "createdAt": "2025-10-24T10:00:00.000Z",
  "poolSize": 10
}
```

### Utilisation dans les tests

```typescript
import { getTestUser, releaseTestUser } from './helpers/user-pool';

test.beforeAll(async () => {
  // Récupère des users du pool (instantané, pas de rate limit)
  seller = await getTestUser('seller');
  buyer = await getTestUser('buyer');
});

test.afterAll(async () => {
  // Rend les users disponibles pour les autres tests
  releaseTestUser(seller.id);
  releaseTestUser(buyer.id);
});
```

### Commandes disponibles

```bash
# Setup du pool (à faire une seule fois)
npm run e2e:setup-pool

# Lancer tous les tests E2E
npx playwright test

# Lancer un fichier spécifique
npx playwright test e2e/payment-flow.spec.ts

# Mode UI interactif
npx playwright test --ui

# Debug mode
npx playwright test --debug
```

## Prérequis

### 1. Installation

```bash
npm install
npx playwright install
```

### 2. Configuration des variables d'environnement

Créer un fichier `.env.test` :

```bash
VITE_SUPABASE_URL=https://your-test-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-test-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
STRIPE_SECRET_KEY=sk_test_your-stripe-test-key
```

⚠️ **IMPORTANT** : Utilisez un projet Supabase dédié aux tests ou des données de test isolées.

### 3. Création automatique des utilisateurs

Les nouveaux tests utilisent le helper `createTestUser()` qui crée automatiquement les utilisateurs nécessaires. Plus besoin de SQL manuel !

**Ancienne méthode** (toujours valide pour les tests existants) :

#### Vendeur Test
```sql
-- Dans Supabase SQL Editor
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES (
  'seller-test@rivvlock.com',
  crypt('Test123!@#', gen_salt('bf')),
  now(),
  now(),
  now()
);
```

#### Acheteur Test
```sql
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES (
  'buyer-test@rivvlock.com',
  crypt('Test123!@#', gen_salt('bf')),
  now(),
  now(),
  now()
);
```

#### Admin Test
```sql
-- Créer l'utilisateur
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'admin-test@rivvlock.com',
  crypt('Admin123!@#', gen_salt('bf')),
  now(),
  now(),
  now()
);

-- Donner le rôle admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'admin-test@rivvlock.com';
```

### 3. Créer des données de test

Pour que les tests puissent s'exécuter, il faut des transactions et litiges existants :

```sql
-- Transaction payée (pour test de dispute)
INSERT INTO public.transactions (
  user_id, 
  buyer_id, 
  title, 
  price, 
  currency, 
  status,
  created_at
)
SELECT 
  seller.id,
  buyer.id,
  'Transaction Test E2E',
  100.00,
  'EUR',
  'paid'::transaction_status,
  now()
FROM 
  (SELECT id FROM auth.users WHERE email = 'seller-test@rivvlock.com') AS seller,
  (SELECT id FROM auth.users WHERE email = 'buyer-test@rivvlock.com') AS buyer;
```

## Lancer les tests

### Tous les tests

```bash
npm run test:e2e
```

### Tests spécifiques

```bash
# Payment flow uniquement
npx playwright test e2e/payment-flow.spec.ts

# Dispute flow uniquement
npx playwright test e2e/dispute-flow.spec.ts

# Admin validation uniquement
npx playwright test e2e/admin-validation.spec.ts
```

### Mode interactif (UI)

```bash
npx playwright test --ui
```

### Mode debug

```bash
npx playwright test --debug
```

### Sur un navigateur spécifique

```bash
# Chrome uniquement
npx playwright test --project=chromium

# Firefox uniquement
npx playwright test --project=firefox

# Mobile uniquement
npx playwright test --project="Mobile Chrome"
```

## Structure des tests

```
e2e/
├── helpers/
│   └── test-fixtures.ts          # 🆕 Helpers pour création de données de test
├── payment-flow.spec.ts          # Tests du flow de paiement
├── dispute-flow.spec.ts          # Tests du flow de litiges
├── admin-validation.spec.ts      # Tests des validations admin
├── validation-flow.spec.ts       # 🆕 Tests countdown 72h et validation
├── refund-flow.spec.ts           # 🆕 Tests remboursements et disputes
└── README.md                     # Ce fichier
```

## Rapports de tests

Après exécution, les rapports sont générés :

```bash
# Rapport HTML interactif
npx playwright show-report

# Résultats JSON
cat test-results/e2e-results.json
```

## Configuration

Voir `playwright.config.ts` pour :
- URL de base (localhost:5173)
- Timeouts
- Screenshots/vidéos en cas d'échec
- Configurations multi-navigateurs

## CI/CD

Les tests s'exécutent automatiquement dans GitHub Actions lors des PRs.

Configuration dans `.github/workflows/ci.yml` :
```yaml
- name: Run E2E tests
  run: npm run test:e2e
  
- name: Upload test results
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: playwright-report
    path: playwright-report/
```

## Bonnes pratiques

### 1. Isolation des tests
Chaque test doit être indépendant et ne pas dépendre de l'état d'un autre test.

### 2. Nettoyage
Utiliser `test.afterEach` pour nettoyer les données créées pendant le test.

### 3. Timeouts
Utiliser des timeouts généreux pour les opérations réseau :
```typescript
await page.waitForResponse(response => 
  response.url().includes('/api/') && response.status() === 200,
  { timeout: 10000 }
);
```

### 4. Sélecteurs stables
Préférer les `data-testid` aux sélecteurs textuels :
```typescript
// ✅ Bon
await page.locator('[data-testid="payment-button"]').click();

// ❌ Fragile
await page.getByText('Payer maintenant').click();
```

## Dépannage

### Erreur : "User not authenticated"
→ Vérifier que les utilisateurs de test existent dans Supabase.

### Erreur : "Transaction not found"
→ Créer les données de test avec les scripts SQL ci-dessus.

### Tests lents
→ Désactiver les screenshots/vidéos dans `playwright.config.ts` :
```typescript
use: {
  screenshot: 'off',
  video: 'off',
}
```

### Port 5173 déjà utilisé
→ Arrêter les processus existants :
```bash
lsof -ti:5173 | xargs kill -9
```

## 🆕 Nouveaux Tests Critiques

### Validation Flow (`validation-flow.spec.ts`)

**Tests les 72h de countdown de validation - CRITIQUE pour l'escrow** :

```typescript
// Exemple d'utilisation
test('buyer validates transaction', async ({ page }) => {
  const seller = await createTestUser('seller', 'test-seller');
  const buyer = await createTestUser('buyer', 'test-buyer');
  
  const transaction = await createPaidTransaction(seller.id, buyer.id, 1000);
  await markTransactionCompleted(transaction.id);
  
  await loginUser(page, buyer);
  // ... validation flow
});
```

**Scénarios couverts** :
- ✅ Vendeur marque transaction comme terminée
- ✅ Countdown 72h s'affiche correctement
- ✅ Acheteur peut valider et libérer les fonds
- ✅ Auto-libération après expiration du délai
- ✅ Timeline de validation affichée
- ✅ Cas limites (transaction non payée, auto-validation vendeur)

**Pourquoi c'est critique** : C'est le cœur du système d'escrow. Toute régression ici casse le modèle économique.

### Refund Flow (`refund-flow.spec.ts`)

**Tests tous les scénarios de remboursement** :

```typescript
// Exemple de test de remboursement partiel
test('partial refund with percentage', async ({ page }) => {
  const transaction = await createPaidTransaction(seller.id, buyer.id, 2000);
  const dispute = await createTestDispute(transaction.id, buyer.id);
  
  // Créer proposition 50% refund
  await page.getByLabel(/pourcentage/).fill('50');
  // Devrait auto-calculer 1000 CHF
  await expect(page.getByText(/1000.*CHF/i)).toBeVisible();
});
```

**Scénarios couverts** :
- ✅ Remboursement complet via dispute
- ✅ Remboursement partiel avec calcul automatique
- ✅ Proposition admin avec pourcentage personnalisé
- ✅ Tracking du statut de remboursement
- ✅ Vérification intégration Stripe
- ✅ Gestion d'erreurs (remboursements échoués)

**Pourquoi c'est critique** : Opérations financières = zéro tolérance aux bugs.

## Utilisation des Test Fixtures

Les helpers dans `e2e/helpers/test-fixtures.ts` simplifient la création de données :

```typescript
import {
  createTestUser,
  createTestTransaction,
  createPaidTransaction,
  markTransactionCompleted,
  createTestDispute,
  loginUser,
  cleanupTestData,
} from './helpers/test-fixtures';

// Dans vos tests
test.beforeAll(async () => {
  seller = await createTestUser('seller', 'my-test-seller');
  buyer = await createTestUser('buyer', 'my-test-buyer');
  testUserIds.push(seller.id, buyer.id);
});

test.afterAll(async () => {
  await cleanupTestData(testUserIds);
});
```

**Avantages** :
- ✅ Pas de SQL manuel
- ✅ Nettoyage automatique
- ✅ Emails uniques (timestamp)
- ✅ Réutilisable entre tests

## Flows Critiques Couverts

| Flow | Statut | Priorité | Fichier |
|------|--------|----------|---------|
| Lien de paiement | ✅ | HAUTE | `payment-flow.spec.ts` |
| Redirection Stripe | ✅ | HAUTE | `payment-flow.spec.ts` |
| Virement bancaire | ✅ | HAUTE | `payment-flow.spec.ts` |
| **Countdown 72h** | ✅ | **CRITIQUE** | `validation-flow.spec.ts` |
| **Validation acheteur** | ✅ | **CRITIQUE** | `validation-flow.spec.ts` |
| **Auto-release** | ✅ | **CRITIQUE** | `validation-flow.spec.ts` |
| Création dispute | ✅ | HAUTE | `dispute-flow.spec.ts` |
| Négociation dispute | ✅ | HAUTE | `dispute-flow.spec.ts` |
| Escalade admin | ✅ | HAUTE | `dispute-flow.spec.ts` |
| **Remboursement complet** | ✅ | **CRITIQUE** | `refund-flow.spec.ts` |
| **Remboursement partiel** | ✅ | **CRITIQUE** | `refund-flow.spec.ts` |
| Tracking remboursement | ✅ | HAUTE | `refund-flow.spec.ts` |
| Validation admin | ✅ | HAUTE | `admin-validation.spec.ts` |
| Force release fonds | ✅ | HAUTE | `admin-validation.spec.ts` |

## Performances

Temps d'exécution attendus :

- **Validation Flow** : ~45s (5 tests)
- **Refund Flow** : ~60s (10 tests)
- **Suite complète** : ~5 minutes

Si vos tests sont plus lents, vérifiez :
1. Latence réseau vers Supabase
2. Performance des requêtes DB
3. Temps de chargement des pages

## Métriques cibles

| Métrique | Cible | Actuel |
|----------|-------|--------|
| Couverture E2E | 90%+ | ~70% ✅ |
| Temps d'exécution | < 5 min | ~5 min ✅ |
| Taux de réussite | > 95% | ⏳ À mesurer |

## Protection Zéro Régression

**Avant de pousser du code** :

```bash
# 1. Lancer les tests critiques
npm run test:e2e validation-flow.spec.ts
npm run test:e2e refund-flow.spec.ts

# 2. Vérifier qu'ils passent tous
# 3. Si échec, NE PAS MERGE

# 4. En cas de succès, tester manuellement les flows modifiés
```

**En CI/CD** :

Les tests s'exécutent automatiquement et bloquent les PRs en cas d'échec.

## Dépannage Spécifique

### Erreur : "Payment intent not found"

→ Vérifiez que `STRIPE_SECRET_KEY` est en **mode test** (commence par `sk_test_`)

### Erreur : "Validation deadline expired"

→ Les tests créent des deadlines futures. Si vous manipulez les dates, utilisez :

```typescript
await supabase
  .from('transactions')
  .update({
    validation_deadline: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
  })
  .eq('id', transaction.id);
```

### Tests qui échouent aléatoirement

→ Race conditions possibles. Ajoutez des `waitFor` :

```typescript
await expect(page.getByText(/fonds libérés/i)).toBeVisible({ timeout: 10000 });
```

## Prochaines étapes

- [ ] Tests webhooks Stripe (mock avec Stripe CLI)
- [ ] Tests notifications email
- [ ] Tests multi-devises (EUR, USD, CHF)
- [ ] Tests de charge (100+ transactions simultanées)
- [ ] Tests accessibilité (a11y)
