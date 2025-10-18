# 🚀 Plan d'Action Lancement RivvLock

**Date** : 18 Octobre 2025  
**Objectif** : Préparer l'app pour production  
**Timeline** : 4 semaines

---

## 📋 Vue d'Ensemble

| Phase | Durée | Priorité | Status |
|-------|-------|----------|--------|
| **Phase 1 : Corrections Critiques** | Semaine 1 | 🔴 CRITIQUE | À faire |
| **Phase 2 : Optimisations** | Semaine 2 | 🟡 IMPORTANT | À faire |
| **Phase 3 : Tests Complets** | Semaine 3 | 🟡 IMPORTANT | À faire |
| **Phase 4 : Déploiement** | Semaine 4 | 🟢 FINAL | À faire |

---

## 🔴 PHASE 1 : CORRECTIONS CRITIQUES (Semaine 1)

### 1.1 Sécurité Webhooks Stripe 🔒

**Problème :** Webhooks non sécurisés si activés  
**Impact :** CRITIQUE - Risque manipulation paiements

**Action :**
```typescript
// supabase/functions/stripe-webhook/index.ts
const signature = req.headers.get('stripe-signature');
if (!signature) throw new Error('No signature');

const event = stripe.webhooks.constructEvent(
  body,
  signature,
  Deno.env.get('STRIPE_WEBHOOK_SECRET')!
);
```

**Checklist :**
- [ ] Ajouter secret `STRIPE_WEBHOOK_SECRET` dans Supabase
- [ ] Implémenter vérification signature
- [ ] Tester avec Stripe CLI `stripe listen --forward-to`
- [ ] Documenter endpoint webhook

**Temps estimé : 4h**

---

### 1.2 Refactoring Page Paiement 🔧

**Problème :** Confusion flow paiement (vu dans dernier message)  
**Impact :** UX dégradée - utilisateurs perdus

**Action :**
```typescript
// 1. Créer composant PaymentMethodSelector
src/components/PaymentMethodSelector.tsx

// 2. Séparer logique
- handleCardPayment() -> Stripe
- handleBankTransfer() -> Instructions IBAN
- handlePayPalPayment() -> PayPal (future)

// 3. Ajouter états clairs
type PaymentState = 'selecting' | 'processing' | 'completed' | 'failed';
```

**Checklist :**
- [ ] Créer `PaymentMethodSelector.tsx` propre
- [ ] Ajouter tests unitaires
- [ ] Valider flow complet (3 chemins)
- [ ] Documentation utilisateur

**Temps estimé : 6h**

---

### 1.3 Fix Redirections Payment Links 🔗

**Problème :** Bouton "Payer" redirige vers Stripe au lieu de sélection méthode  
**Impact :** BLOQUANT - Flow cassé

**Action :**
```typescript
// TransactionsPage.tsx - handlePayment()
// ✅ NOUVEAU FLOW
const handlePayment = (transaction) => {
  // 1. Rediriger vers page sélection
  navigate(`/payment-link/${transaction.shared_link_token}`);
  
  // 2. Sur PaymentLinkPage, afficher choix
  // 3. Selon choix -> Stripe OU Virement
};
```

**Checklist :**
- [ ] Corriger `handlePayment` dans `TransactionsPage.tsx`
- [ ] Tester parcours complet
- [ ] Ajouter analytics tracking
- [ ] Vérifier mobile

**Temps estimé : 3h**

---

### 1.4 Audit Sécurité Externe 🛡️

**Objectif :** Validation tierce des RLS policies

**Actions :**
- [ ] Faire audit pénétration (Pentest)
- [ ] Tester bypass RLS manuellement
- [ ] Vérifier isolation données multi-tenant
- [ ] Documenter résultats

**Outils recommandés :**
- Burp Suite (scan vulnérabilités)
- OWASP ZAP (test automatisé)
- Manuel : Postman + JWT manipulation

**Temps estimé : 8h**

---

## 🟡 PHASE 2 : OPTIMISATIONS (Semaine 2)

### 2.1 Optimisation Images 🖼️

**Gain :** -60% taille, +30% vitesse chargement

**Actions :**
```bash
# 1. Installer outil compression
npm install sharp

# 2. Script conversion
node scripts/convert-images-to-webp.js

# 3. Résultats attendus
public/assets/rivvlock-logo.jpg (150KB) -> logo.webp (45KB)
```

**Checklist :**
- [ ] Convertir tous JPG/PNG en WebP
- [ ] Ajouter fallback PNG pour vieux navigateurs
- [ ] Tester Safari, Firefox, Chrome
- [ ] Mettre à jour imports composants

**Temps estimé : 4h**

---

### 2.2 Pagination Transactions 📄

**Problème :** Fetch ALL transactions = lent à 1000+ items  
**Gain :** -80% temps chargement initial

**Action :**
```typescript
// hooks/useTransactions.ts
const useTransactions = (page = 1, limit = 50) => {
  return useQuery({
    queryKey: ['transactions', page, limit],
    queryFn: async () => {
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .range(from, to)
        .order('created_at', { ascending: false });
      
      return data;
    }
  });
};
```

**Checklist :**
- [ ] Implémenter pagination hook
- [ ] Ajouter composant `<Pagination />`
- [ ] Tester avec 1000+ transactions mockées
- [ ] Ajouter infinite scroll (optionnel)

**Temps estimé : 6h**

---

### 2.3 Debouncing Filtres ⏱️

**Problème :** Recherche = requête à chaque caractère  
**Gain :** -90% requêtes API

**Action :**
```typescript
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

const [search, setSearch] = useState('');
const debouncedSearch = useDebouncedValue(search, 300);

// Utiliser debouncedSearch dans query
const { data } = useTransactions({ search: debouncedSearch });
```

**Checklist :**
- [ ] Créer `useDebouncedValue` hook
- [ ] Appliquer sur tous les filtres
- [ ] Tester UX (300ms acceptable)
- [ ] Ajouter loading indicator

**Temps estimé : 3h**

---

### 2.4 Refactoring Edge Functions 🔄

**Problème :** Code dupliqué dans 10+ fonctions  
**Gain :** -40% code, +50% maintenabilité

**Action :**
```typescript
// supabase/functions/_shared/payment-utils.ts
export async function getOrCreateStripeCustomer(userId: string) {
  // Code partagé
}

export async function validatePaymentAmount(amount: number) {
  // Code partagé
}

// Utiliser dans create-payment-checkout, create-transaction, etc.
```

**Checklist :**
- [ ] Identifier fonctions dupliquées
- [ ] Créer `_shared/payment-utils.ts`
- [ ] Créer `_shared/transaction-utils.ts`
- [ ] Refactorer 10+ edge functions
- [ ] Tests unitaires utils

**Temps estimé : 8h**

---

### 2.5 Composants Monolithiques 📦

**Problème :** `TransactionsPage.tsx` = 800 lignes  
**Solution :** Extraire sous-composants

**Structure cible :**
```
src/components/transactions/
├── TransactionsList.tsx (liste virtualisée)
├── TransactionFilters.tsx (filtres)
├── TransactionStats.tsx (statistiques)
└── TransactionActions.tsx (actions bulk)
```

**Checklist :**
- [ ] Extraire `TransactionsList` 
- [ ] Extraire `TransactionFilters`
- [ ] Ajouter tests composants
- [ ] Refactorer `DashboardPage` (même principe)

**Temps estimé : 6h**

---

## 🧪 PHASE 3 : TESTS COMPLETS (Semaine 3)

### 3.1 Tests Unitaires 🎯

**Objectif :** 65% → 85% coverage

**Plan :**
```bash
# Hooks (priorité haute)
src/hooks/__tests__/
├── useTransactions.test.tsx ✅
├── useDisputes.test.tsx ✅
├── usePayment.test.tsx ❌ À créer
└── useStripeAccount.test.tsx ✅

# Composants critiques
src/components/__tests__/
├── PaymentMethodSelector.test.tsx ❌ À créer
├── TransactionCard.test.tsx ❌ À créer
└── DisputeCard.test.tsx ✅

# Utilitaires
src/lib/__tests__/
├── validations.test.ts ✅
├── paymentUtils.test.ts ❌ À créer
└── pdfGenerator.test.ts ✅
```

**Checklist :**
- [ ] Créer 10 nouveaux tests
- [ ] Atteindre 85% coverage
- [ ] CI/CD : bloquer merge si < 80%

**Temps estimé : 12h**

---

### 3.2 Tests E2E (End-to-End) 🔗

**Outil :** Playwright

**Scénarios critiques :**

```typescript
// tests/e2e/payment-flow.spec.ts
test('Complete payment flow - Card', async ({ page }) => {
  // 1. Login
  await page.goto('/auth');
  await page.fill('[name="email"]', 'test@test.com');
  await page.click('button[type="submit"]');
  
  // 2. Créer transaction
  await page.goto('/transactions/new');
  await page.fill('[name="title"]', 'Test Transaction');
  await page.fill('[name="price"]', '100');
  await page.click('button:has-text("Créer")');
  
  // 3. Payer par carte
  await page.click('button:has-text("Payer")');
  await page.click('[data-testid="payment-method-card"]');
  
  // 4. Stripe checkout (mock)
  await expect(page).toHaveURL(/stripe\.com/);
});
```

**Scénarios à tester :**
1. ✅ Création transaction complète
2. ✅ Paiement carte (mock Stripe)
3. ✅ Paiement virement bancaire
4. ✅ Création dispute
5. ✅ Acceptation proposition
6. ✅ Validation service
7. ✅ Génération facture

**Checklist :**
- [ ] Installer Playwright
- [ ] Créer 7 tests E2E
- [ ] Configurer CI/CD Playwright
- [ ] Ajouter screenshots échecs

**Temps estimé : 16h**

---

### 3.3 Tests Performance 📊

**Outil :** Lighthouse + k6

**Tests à effectuer :**

```javascript
// tests/performance/load-test.js (k6)
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 0 },   // Ramp down
  ],
};

export default function () {
  const res = http.get('https://app.rivvlock.com/api/transactions');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
```

**Métriques cibles :**
- ⚡ First Contentful Paint : < 1.5s
- ⚡ Time to Interactive : < 3s
- ⚡ API Response P95 : < 300ms
- ⚡ Concurrent users : 100+ sans dégradation

**Checklist :**
- [ ] Lighthouse audit (mobile + desktop)
- [ ] k6 load testing (100 users)
- [ ] Test Stripe webhook sous charge
- [ ] Documenter résultats

**Temps estimé : 8h**

---

### 3.4 Tests Sécurité 🔐

**Scénarios à tester manuellement :**

```bash
# 1. Bypass RLS (Postman)
# Essayer accéder transaction d'un autre user
curl -X GET https://[...].supabase.co/rest/v1/transactions?id=eq.xxx \
  -H "Authorization: Bearer [autre_user_jwt]"
# ✅ Doit retourner 0 résultats

# 2. SQL Injection
# Essayer injecter SQL dans filtres
?search='; DROP TABLE users; --
# ✅ Doit être échappé par Zod

# 3. XSS
# Essayer injecter script dans title transaction
<script>alert('XSS')</script>
# ✅ Doit être échappé en HTML entities
```

**Checklist :**
- [ ] Tester bypass RLS (10 scénarios)
- [ ] Tester SQL injection
- [ ] Tester XSS (messages, disputes)
- [ ] Tester CSRF tokens
- [ ] Vérifier rate limiting

**Temps estimé : 8h**

---

## 🚀 PHASE 4 : DÉPLOIEMENT (Semaine 4)

### 4.1 Configuration Production 🔧

**Checklist environnement :**

```bash
# Supabase Production
- [ ] Activer pooling DB (connection limit)
- [ ] Configurer auto-backup quotidien
- [ ] Activer Point-in-Time Recovery (PITR)
- [ ] Limiter API rate (1000 req/min par IP)

# Stripe Production
- [ ] Basculer clés Live (pas Test)
- [ ] Configurer webhook URL production
- [ ] Tester paiement réel 0.50€
- [ ] Activer Radar (détection fraude)

# DNS & Domaine
- [ ] Configurer domaine principal (rivvlock.com)
- [ ] Certificat SSL (Let's Encrypt auto)
- [ ] CDN Cloudflare (optionnel)

# Monitoring
- [ ] Sentry DSN production
- [ ] Configurer alertes email
- [ ] Dashboard Supabase actif
```

---

### 4.2 Documentation Finale 📚

**Documents à créer/mettre à jour :**

1. **User Guide (FR/EN/DE)**
   - Comment créer une transaction
   - Comment payer
   - Comment créer un dispute
   - FAQ

2. **API Documentation**
   - Liste edge functions publiques
   - Exemples d'appels
   - Rate limits

3. **Runbook Ops**
   - Que faire si paiement échoue
   - Rollback procédure
   - Contact support

**Checklist :**
- [ ] User guide 3 langues
- [ ] API docs (Swagger optionnel)
- [ ] Runbook ops
- [ ] Changelog public

**Temps estimé : 8h**

---

### 4.3 Soft Launch (Beta) 🎯

**Stratégie :**

```
Semaine 4.1 : Alpha fermée (10 users internes)
  - Tester tous les flows
  - Corriger bugs critiques
  
Semaine 4.2 : Beta privée (50 users)
  - Invitations sur demande
  - Feedback intensif
  - Support réactif
  
Semaine 4.3 : Beta publique (500 users)
  - Landing page + blog post
  - Support ticket system
  
Semaine 4.4 : Launch public ✅
```

**Checklist :**
- [ ] Inviter 10 alpha testers
- [ ] Créer formulaire feedback
- [ ] Monitorer erreurs Sentry 24/7
- [ ] Préparer hotfixes rapides

---

### 4.4 Plan de Rollback 🔄

**Si problème critique en production :**

```bash
# 1. Rollback code (< 5min)
git revert HEAD
git push production

# 2. Rollback DB (si migration)
# Via Supabase Dashboard > Restore PITR

# 3. Communication
# Email tous les users actifs
# Status page (status.rivvlock.com)

# 4. Post-mortem
# Document incident
# Corriger root cause
```

**Checklist :**
- [ ] Script rollback automatique
- [ ] Liste emails users actifs
- [ ] Template email incident
- [ ] Procédure escalade

---

## 📊 MÉTRIQUES DE SUCCÈS

### KPIs à suivre (Semaine 1-4)

| Métrique | Baseline | Target | Critique |
|----------|----------|--------|----------|
| Temps réponse API P95 | 300ms | < 200ms | < 500ms |
| Taux erreur paiement | ? | < 2% | < 5% |
| Taux conversion checkout | ? | > 80% | > 60% |
| Coverage tests | 65% | 85% | > 70% |
| Lighthouse Performance | ? | > 90 | > 80 |
| Incidents sécurité | 0 | 0 | 0 |

---

## ⏱️ PLANNING DÉTAILLÉ

### Semaine 1 (21h)
```
Lundi    : Webhooks Stripe (4h)
Mardi    : Refactoring paiement (6h)
Mercredi : Fix redirections (3h)
Jeudi    : Audit sécurité (8h)
Vendredi : Buffer / Review
```

### Semaine 2 (27h)
```
Lundi    : Images WebP (4h)
Mardi    : Pagination (6h)
Mercredi : Debouncing (3h)
Jeudi    : Refactoring functions (8h)
Vendredi : Refactoring composants (6h)
```

### Semaine 3 (44h)
```
Lundi-Mardi    : Tests unitaires (12h)
Mercredi-Jeudi : Tests E2E (16h)
Vendredi       : Tests perfs + sécu (16h)
```

### Semaine 4 (16h)
```
Lundi    : Config production (4h)
Mardi    : Documentation (8h)
Mercredi : Soft launch alpha
Jeudi    : Soft launch beta
Vendredi : LAUNCH PUBLIC 🚀
```

**TOTAL : ~110 heures de travail**

---

## 🎯 CHECKLIST FINALE LANCEMENT

### Technique ✅
- [ ] Tous les tests passent (unit + E2E)
- [ ] Coverage > 85%
- [ ] Lighthouse > 90
- [ ] Zero vulnérabilité critique
- [ ] Backup auto configuré
- [ ] Monitoring actif

### Business ✅
- [ ] CGV validées
- [ ] Privacy policy à jour
- [ ] Support email configuré
- [ ] Tarification claire
- [ ] Landing page live

### Communication ✅
- [ ] Blog post annonce
- [ ] Réseaux sociaux
- [ ] Newsletter users beta
- [ ] Press kit (si applicable)

---

## 🆘 CONTACTS D'URGENCE

**Technique :**
- Supabase Support : support@supabase.com
- Stripe Support : support@stripe.com

**Équipe :**
- [Votre nom] : Lead Dev
- [Backup] : Support technique

---

**Document créé le : 18 Octobre 2025**  
**Version : 1.0**  
**Prochaine révision : Après chaque phase**
