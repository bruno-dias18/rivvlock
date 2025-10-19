# 🔒 RÈGLES DE STABILITÉ STRIPE - NE JAMAIS MODIFIER

## ⚠️ CRITICAL: Ce document définit ce qui ne doit JAMAIS changer dans l'intégration Stripe

### 1. Version API Stripe - VERROUILLÉE
```typescript
apiVersion: "2024-06-20"  // ✅ NE JAMAIS CHANGER
```

**Raison**: Stripe `2025-08-27.basil` a causé des crashes en production. La version `2024-06-20` est stable et testée.

**Fonctions concernées**:
- `check-stripe-account-status`
- `create-stripe-account`
- `refresh-counterparty-stripe-status`
- `update-stripe-account-info`
- `validate-stripe-accounts`

### 2. Signatures de fonction Edge - OBLIGATOIRE
```typescript
// ✅ TOUJOURS utiliser cette signature exacte:
const handler: Handler = async (req, ctx: HandlerContext) => {
  const { user, adminClient, supabaseClient, body } = ctx;
  // ...
}

// ❌ JAMAIS:
const handler = async (ctx: any) => { /* ... */ }
const handler = async (ctx) => { /* ... */ }
```

**Raison**: Sans la signature correcte, le middleware `withAuth` ne fonctionne pas et les fonctions retournent des erreurs "non-2xx".

### 3. Middleware requis pour toutes les fonctions authentifiées
```typescript
const composedHandler = compose(
  withCors,    // ✅ TOUJOURS en premier
  withAuth     // ✅ TOUJOURS pour les fonctions nécessitant l'auth
)(handler);
```

### 4. Imports minimaux requis
```typescript
import { 
  Handler,           // ✅ Obligatoire pour le typage
  HandlerContext,    // ✅ Obligatoire pour le typage
  compose,
  withCors,
  withAuth,
  successResponse,
  errorResponse
} from "../_shared/middleware.ts";
```

### 5. Configuration Supabase - config.toml
```toml
[functions.check-stripe-account-status]
verify_jwt = true  # ✅ NE PAS CHANGER

[functions.create-stripe-account]
verify_jwt = true  # ✅ NE PAS CHANGER

[functions.refresh-counterparty-stripe-status]
verify_jwt = true  # ✅ NE PAS CHANGER

[functions.update-stripe-account-info]
verify_jwt = true  # ✅ NE PAS CHANGER

[functions.validate-stripe-accounts]
verify_jwt = true  # ✅ NE PAS CHANGER (admin check dans le code)
```

### 6. Checklist avant modification d'une fonction Stripe

Avant de toucher à une fonction Stripe, vérifier:
- [ ] La version API est-elle `"2024-06-20"` ?
- [ ] La signature est-elle `Handler = async (req, ctx: HandlerContext)` ?
- [ ] Les imports incluent-ils `Handler` et `HandlerContext` ?
- [ ] Le middleware inclut-il `withAuth` si auth requise ?
- [ ] Le `config.toml` définit-il `verify_jwt = true` si auth requise ?

### 7. Tests de non-régression

Après toute modification:
1. Tester la création d'une transaction (nécessite Stripe account actif)
2. Tester "Configurer mes coordonnées bancaires" (dashboard)
3. Tester "Validation des comptes Stripe Connect" (page admin)

### 8. Logs obligatoires pour debug

Toutes les fonctions Stripe doivent inclure:
```typescript
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  logger.log(`[FUNCTION-NAME] ${step}${detailsStr}`);
};
```

Usage:
```typescript
logStep("Function started");
logStep("User authenticated", { userId: user.id });
logStep("Stripe account retrieved", { accountId: "acct_xxx" });
logStep("ERROR", { message: error.message });
```

---

## 🚨 EN CAS D'ERREUR "non-2xx status code"

1. Vérifier la signature de la fonction concernée
2. Vérifier que `withAuth` est dans le `compose()`
3. Vérifier que `Handler` et `HandlerContext` sont importés
4. Consulter les logs Edge Function dans Supabase Dashboard

---

**Date de création**: 2025-01-19  
**Dernière révision**: 2025-01-19  
**Responsable**: System Architect  
**Statut**: 🔒 VERROUILLÉ - Modifications interdites sans validation explicite
