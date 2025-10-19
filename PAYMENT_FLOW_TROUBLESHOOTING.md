# Guide de Dépannage - Flux de Paiement par Lien Partagé

## Problèmes Rencontrés et Solutions

### 1. ❌ Erreur "Edge Function returned a non-2xx status code"

#### Causes Identifiées:

**A. Session Supabase expirée (401 Unauthorized)**
- **Symptôme**: L'utilisateur ouvre un lien de paiement mais sa session a expiré
- **Impact**: `create-payment-checkout` (qui nécessite `verify_jwt = true`) rejette la requête
- **Solution Appliquée**:
  ```typescript
  // Dans PaymentLinkPage.tsx - catch block
  if (text.includes('401') || text.includes('unauthorized') || text.includes('jwt') || text.includes('session')) {
    setError('Session expirée. Veuillez vous reconnecter pour poursuivre le paiement.');
    navigate(`/auth?redirect=${encodeURIComponent(redirectUrl)}`);
  }
  ```

**B. API Stripe version instable**
- **Erreur**: Utilisation de `"2025-08-27.basil"` au lieu de la version stable
- **Référence**: `STRIPE_STABILITY_RULES.md` spécifie que la version stable est `"2024-06-20"`
- **Solution Appliquée**:
  ```typescript
  // Dans create-payment-checkout/index.ts
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2024-06-20", // ✅ Version stable uniquement
  });
  ```

**C. Lien partagé sans buyer_id (logique de claim)**
- **Problème**: Quand un utilisateur ouvre un lien partagé (buyer_id = NULL), l'edge function ne l'assignait pas automatiquement
- **Solution Appliquée**:
  ```typescript
  // Dans create-payment-checkout/index.ts
  if (!transaction.buyer_id) {
    // Claim automatique de la transaction pour l'utilisateur connecté
    const { data: claimed, error: claimError } = await adminClient!
      .from('transactions')
      .update({
        buyer_id: user!.id,
        client_email: transaction.client_email || user!.email || null,
        buyer_display_name: transaction.buyer_display_name || user!.email || null,
      })
      .eq('id', transactionId)
      .is('buyer_id', null)
      .select('*')
      .single();
  }
  ```

**D. join-transaction bloquait le flux de paiement**
- **Problème**: L'appel à `join-transaction` était bloquant et échouait si:
  - Le token était invalide
  - Le délai de 24h avant le service n'était pas respecté
- **Solution Appliquée**:
  ```typescript
  // Dans PaymentLinkPage.tsx - handlePayNow
  // join-transaction devient "best-effort" (non-bloquant)
  try {
    await supabase.functions.invoke('join-transaction', {...});
  } catch (joinErr) {
    logger.warn('Join transaction skipped (continuing to checkout):', joinErr);
    // Le checkout se fait quand même grâce au claim automatique
  }
  ```

---

## ✅ Architecture Correcte du Flux de Paiement par Lien Partagé

### Étape 1: L'utilisateur ouvre le lien
```
URL: /payment-link/:token
État: Anonyme ou connecté
```

### Étape 2: Vérification de la session
- Si **non connecté**: Afficher bouton "Se connecter pour payer"
- Si **connecté**: Afficher le sélecteur de mode de paiement

### Étape 3: Tentative de join automatique (best-effort)
```typescript
// useEffect dans PaymentLinkPage.tsx
useEffect(() => {
  if (user && transaction && !autoJoined) {
    autoJoinTransaction(); // Non-bloquant
  }
}, [user, transaction]);
```

### Étape 4: Clic sur "Payer"
1. **Tentative de join** (si pas déjà fait) - **best-effort**
2. **create-payment-checkout** qui:
   - Vérifie/crée le client Stripe
   - **Claim automatique** si buyer_id est NULL
   - Crée la session Stripe Checkout
3. **Redirection** vers Stripe

---

## 🔒 Règles de Sécurité et Stabilité

### 1. Version API Stripe
```typescript
// ✅ TOUJOURS utiliser la version stable
apiVersion: "2024-06-20"

// ❌ NE JAMAIS utiliser de version beta/récente
apiVersion: "2025-08-27.basil" // INTERDIT
```

### 2. Gestion des sessions expirées
```typescript
// ✅ Détecter et rediriger automatiquement
if (error.includes('401') || error.includes('unauthorized')) {
  navigate(`/auth?redirect=${returnUrl}`);
}
```

### 3. Claim automatique dans create-payment-checkout
```typescript
// ✅ Si buyer_id est NULL, claim pour l'utilisateur connecté
if (!transaction.buyer_id) {
  // Update avec WHERE buyer_id IS NULL pour éviter les conflits
  await adminClient.update({...}).is('buyer_id', null);
}
```

### 4. Appels non-bloquants
```typescript
// ✅ Les étapes préparatoires ne doivent pas bloquer le paiement
try {
  await prepareStep();
} catch (err) {
  logger.warn('Step skipped:', err);
  // Continue quand même
}
```

---

## 🧪 Tests à Faire Avant Déploiement

### Test 1: Lien partagé + session expirée
1. Créer une transaction
2. Générer un lien partagé
3. Se déconnecter
4. Ouvrir le lien → Doit rediriger vers /auth
5. Se connecter → Retour automatique vers le lien
6. Choisir mode de paiement → Paiement doit fonctionner

### Test 2: Lien partagé + utilisateur connecté
1. Créer une transaction
2. Générer un lien partagé
3. Se connecter avec un autre compte
4. Ouvrir le lien → Doit auto-join la transaction
5. Choisir mode de paiement → Paiement doit fonctionner

### Test 3: Lien déjà utilisé
1. Créer une transaction
2. Générer un lien partagé
3. User A ouvre et paie
4. User B ouvre le même lien → Doit afficher "déjà pris"

---

## 📝 Checklist Avant Modification du Flux de Paiement

- [ ] Vérifier STRIPE_STABILITY_RULES.md pour la version API
- [ ] S'assurer que les erreurs auth redirigent vers /auth
- [ ] Tester avec session expirée
- [ ] Tester avec buyer_id NULL (lien partagé)
- [ ] Vérifier que les étapes non-critiques sont best-effort
- [ ] Ajouter des logs détaillés dans les edge functions
- [ ] Tester les cas limites (délais, tokens invalides, etc.)

---

## 🚨 Erreurs à Ne Plus Jamais Faire

1. ❌ Utiliser une version Stripe non documentée dans STRIPE_STABILITY_RULES.md
2. ❌ Rendre join-transaction bloquant avant le checkout
3. ❌ Ne pas gérer les sessions expirées côté frontend
4. ❌ Ne pas implémenter le claim automatique dans create-payment-checkout
5. ❌ Supprimer les logs détaillés des edge functions
6. ❌ Ne pas tester le flux complet avec différents états (anonyme, connecté, expiré)

---

## 📚 Fichiers Critiques

- `supabase/functions/create-payment-checkout/index.ts` - Claim + Stripe
- `supabase/functions/join-transaction/index.ts` - Assignment acheteur
- `src/pages/PaymentLinkPage.tsx` - UI et orchestration
- `STRIPE_STABILITY_RULES.md` - Règles de stabilité Stripe
- `supabase/config.toml` - Configuration verify_jwt

---

**Date de création**: 2025-10-19
**Dernière mise à jour**: 2025-10-19
**Statut**: ✅ Toutes les corrections appliquées
