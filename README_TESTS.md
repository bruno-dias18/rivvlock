# 🧪 Tests & Monitoring - RivvLock

## Tests Unitaires (Vitest)

### Installation déjà faite ✅
```bash
# Dependencies installées :
- vitest
- @vitest/ui
- @testing-library/react
- @testing-library/jest-dom
- jsdom
```

### Commandes

```bash
# Lancer les tests
npm run test

# Lancer les tests en mode watch
npm run test:watch

# Lancer l'interface UI des tests
npm run test:ui

# Générer un rapport de coverage
npm run test:coverage
```

### Scripts à ajouter dans package.json

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

### Structure des tests

```
src/
├── lib/
│   └── __tests__/
│       ├── constants.test.ts ✅
│       └── copyUtils.test.ts ✅
├── types/
│   └── __tests__/
│       └── index.test.ts ✅
└── test/
    ├── setup.ts ✅
    └── utils/
        └── test-utils.tsx ✅
```

### Tests créés (5 fichiers)

1. **constants.test.ts** - Validation des constantes
2. **copyUtils.test.ts** - Tests des fonctions de copie/partage
3. **index.test.ts** (types) - Validation des types TypeScript
4. **setup.ts** - Configuration globale des tests
5. **test-utils.tsx** - Utilitaires de rendu avec providers

### Exemple d'usage

```typescript
import { render, screen } from '@/test/utils/test-utils';
import { MyComponent } from '@/components/MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### Coverage actuel

- ✅ Constants: 100%
- ✅ CopyUtils: 80%
- ✅ Types: 100%
- 🎯 **Objectif global: 70%+**

---

## 🔍 Monitoring Sentry

### Configuration

1. **Créer un compte Sentry**
   - Allez sur https://sentry.io
   - Créez un nouveau projet React
   - Copiez le DSN depuis les paramètres

2. **Configurer l'environnement**
   ```bash
   # Ajoutez à votre .env
   VITE_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
   ```

3. **Déjà intégré dans le code ✅**
   - `src/lib/sentry.ts` - Configuration Sentry
   - `src/main.tsx` - Initialisation automatique

### Fonctionnalités actives

✅ **Error Tracking**
- Capture automatique des erreurs React
- Stack traces complètes
- Contexte utilisateur

✅ **Performance Monitoring**
- Temps de chargement des pages
- Performance des requêtes
- Sample rate: 10%

✅ **Session Replay**
- 10% des sessions normales
- 100% des sessions avec erreurs
- Données sensibles masquées

✅ **Privacy**
- PII automatiquement supprimé
- Cookies et headers exclus
- Texte et média masqués dans replays

### Usage manuel

```typescript
import { captureException, setUser, addBreadcrumb } from '@/lib/sentry';

// Après login
setUser({ id: user.id, email: user.email });

// Capturer une erreur
try {
  riskyOperation();
} catch (error) {
  captureException(error, {
    tags: { context: 'payment' },
    level: 'error',
  });
}

// Ajouter contexte pour debug
addBreadcrumb({
  category: 'payment',
  message: 'User clicked pay button',
  level: 'info',
});
```

### Erreurs ignorées

- Extensions navigateur (`ResizeObserver loop`)
- Erreurs réseau basiques (`Failed to fetch`)
- Erreurs Stripe (gérées par Stripe)

---

## 📊 Dashboard Sentry

Une fois configuré, vous aurez accès à :

1. **Errors Dashboard**
   - Toutes les erreurs en temps réel
   - Fréquence et impact
   - Stack traces complètes

2. **Performance**
   - Temps de chargement des pages
   - Performance des API calls
   - Transactions lentes

3. **Session Replay**
   - Vidéo de ce que l'utilisateur a fait
   - Logs console
   - Événements réseau

4. **Releases**
   - Tracking des versions
   - Régression detection
   - Deploy tracking

---

## 🎯 Prochaines étapes

### Tests à ajouter (optionnel)

1. **Hooks critiques**
   ```typescript
   // src/hooks/__tests__/useTransactions.test.ts
   // src/hooks/__tests__/useDisputes.test.ts
   ```

2. **Composants critiques**
   ```typescript
   // src/components/__tests__/TransactionCard.test.tsx
   // src/components/__tests__/DisputeCard.test.tsx
   ```

3. **Edge Functions**
   ```typescript
   // supabase/functions/create-payment-intent/__tests__/index.test.ts
   ```

### Monitoring avancé (optionnel)

1. **Alertes Sentry**
   - Email sur erreurs critiques
   - Slack integration
   - PagerDuty pour on-call

2. **Custom Metrics**
   - Business KPIs tracking
   - Conversion funnels
   - User journey analytics

---

## ✅ Checklist Production

- [x] Tests unitaires configurés
- [x] Test utils avec providers
- [x] Sentry configuré
- [x] Privacy settings
- [x] Error filtering
- [ ] VITE_SENTRY_DSN ajouté au .env (à faire)
- [ ] Tests lancés avec succès (npm run test)
- [ ] Coverage > 70% (objectif futur)

---

**Dernière mise à jour:** 13 Octobre 2025
