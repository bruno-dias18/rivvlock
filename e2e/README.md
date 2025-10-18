# Tests E2E RivvLock

## Vue d'ensemble

Tests End-to-End Playwright pour valider les parcours critiques de RivvLock :
- ✅ **Payment Flow** : Paiement complet (CB + virement)
- ✅ **Dispute Flow** : Création, négociation, escalade, résolution
- ✅ **Admin Validation** : Gestion transactions, litiges, utilisateurs

## Prérequis

### 1. Installation

```bash
npm install
```

### 2. Créer les utilisateurs de test

Les tests nécessitent 3 utilisateurs de test dans Supabase :

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
├── payment-flow.spec.ts          # Tests du flow de paiement
├── dispute-flow.spec.ts          # Tests du flow de litiges
├── admin-validation.spec.ts      # Tests des validations admin
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

## Métriques cibles

| Métrique | Cible | Actuel |
|----------|-------|--------|
| Couverture E2E | 80% | ⏳ En cours |
| Temps d'exécution | < 5 min | ⏳ À mesurer |
| Taux de réussite | > 95% | ⏳ À mesurer |

## Prochaines étapes

- [ ] Ajouter tests multi-devises
- [ ] Tester les webhooks Stripe
- [ ] Tester les notifications par email
- [ ] Ajouter tests de performance (load testing)
- [ ] Intégrer avec monitoring (Sentry)
