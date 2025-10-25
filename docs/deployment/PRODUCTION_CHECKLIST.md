# 📋 Checklist Production - RivvLock

## Date de vérification : _______________

---

## ✅ Phase 1 : Sécurité

### Base de données
- [ ] Toutes les tables ont RLS activé
- [ ] Policies RLS testées pour chaque rôle (buyer/seller/admin)
- [ ] Aucune donnée sensible dans les logs
- [ ] Leaked Password Protection activé (Supabase Auth)
- [ ] Extensions PostgreSQL dans schéma dédié (non public)

### API & Edge Functions
- [ ] Toutes les Edge Functions valident les inputs (Zod)
- [ ] Rate limiting configuré sur endpoints publics
- [ ] Pas de secrets dans le code (vérifier avec trufflehog)
- [ ] CORS correctement configuré
- [ ] JWT vérifié sur tous les endpoints authentifiés

### Frontend
- [ ] Pas de `dangerouslySetInnerHTML` avec données utilisateur
- [ ] Validation client-side sur tous les formulaires
- [ ] Pas de données sensibles en localStorage
- [ ] CSP headers configurés (si applicable)

### Stripe
- [ ] Clé secrète en mode **Live** uniquement
- [ ] Webhooks configurés avec signature verification
- [ ] Montants toujours en cents (pas de décimales)
- [ ] Idempotency keys pour paiements

**Score Sécurité : ___/20**

---

## ✅ Phase 2 : Performance

### Frontend
- [ ] Bundle size < 500 KB (gzipped)
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3s
- [ ] Lazy loading images activé
- [ ] Code splitting sur routes principales
- [ ] Virtual scrolling sur listes > 20 items

### Backend
- [ ] Queries Supabase optimisées (index, select columns)
- [ ] Pas de N+1 queries
- [ ] Cache configuré sur données statiques
- [ ] Edge Functions < 200ms response time

### Monitoring
- [ ] Performance monitoring activé (`monitoring.ts`)
- [ ] Logs structurés (pas de console.log raw)
- [ ] Métriques collectées (render time, API calls)

**Score Performance : ___/15**

---

## ✅ Phase 3 : Tests

### Tests automatisés
- [ ] Tests unitaires composants (>80% coverage)
- [ ] Tests Edge Functions utilitaires (100% coverage)
- [ ] Tests end-to-end critiques (paiement, création transaction)
- [ ] CI/CD configuré (GitHub Actions)

### Tests manuels
- [ ] Parcours utilisateur complet testé (buyer)
- [ ] Parcours utilisateur complet testé (seller)
- [ ] Gestion des litiges testée
- [ ] Emails testés (tous les templates)
- [ ] Responsive testé (mobile, tablet, desktop)

**Score Tests : ___/10**

---

## ✅ Phase 4 : Fonctionnel

### Authentification
- [ ] Inscription fonctionne
- [ ] Connexion fonctionne
- [ ] Récupération mot de passe fonctionne
- [ ] Déconnexion fonctionne
- [ ] Protection routes authentifiées

### Transactions
- [ ] Création transaction (seller)
- [ ] Partage lien de paiement
- [ ] Paiement Stripe (card + bank transfer)
- [ ] Validation acheteur
- [ ] Validation vendeur
- [ ] Libération fonds
- [ ] Téléchargement facture

### Litiges
- [ ] Création litige
- [ ] Propositions négociation
- [ ] Escalade admin
- [ ] Résolution litige
- [ ] Remboursements partiels/complets

### Emails
- [ ] Transaction créée
- [ ] Paiement reçu
- [ ] Rappels paiement
- [ ] Validation requise
- [ ] Litige créé
- [ ] Fonds libérés

**Score Fonctionnel : ___/22**

---

## ✅ Phase 5 : Configuration Production

### Supabase
- [ ] URL production configurée
- [ ] Secrets Edge Functions configurés
- [ ] Cron jobs activés
- [ ] Backups automatiques vérifiés
- [ ] RLS audit effectué (linter Supabase)

### Stripe
- [ ] Mode Live activé
- [ ] Webhooks configurés
- [ ] Customer Portal activé
- [ ] Produits/Prix créés
- [ ] Compte bancaire vérifié

### Email (Resend)
- [ ] Domaine vérifié
- [ ] SPF/DKIM/DMARC configurés
- [ ] Templates testés
- [ ] Limites d'envoi vérifiées

### Monitoring
- [ ] Sentry configuré (optionnel)
- [ ] Analytics configurés
- [ ] Alertes erreurs configurées
- [ ] Dashboard métriques accessible

**Score Configuration : ___/16**

---

## ✅ Phase 6 : Documentation

### Technique
- [ ] README.md à jour
- [ ] DEPLOYMENT_GUIDE.md créé
- [ ] Edge Functions documentées
- [ ] Architecture documentée (ARCHITECTURE.md)
- [ ] Guide développeur à jour

### Utilisateur
- [ ] CGV/CGU accessibles
- [ ] Politique de confidentialité
- [ ] FAQ disponible
- [ ] Guide utilisateur (optionnel)

**Score Documentation : ___/9**

---

## ✅ Phase 7 : Legal & Compliance

### RGPD
- [ ] Consentement cookies
- [ ] Droit à l'oubli implémenté
- [ ] Export données utilisateur
- [ ] Rétention données configurée (90 jours)
- [ ] DPO désigné (si applicable)

### CGV/CGU
- [ ] Conditions générales rédigées
- [ ] Politique remboursement claire
- [ ] Mentions légales complètes
- [ ] Acceptation obligatoire à l'inscription

**Score Legal : ___/9**

---

## 📊 Score Global

| Catégorie | Score | Max | % |
|-----------|-------|-----|---|
| Sécurité | ___ | 20 | ___% |
| Performance | ___ | 15 | ___% |
| Tests | ___ | 10 | ___% |
| Fonctionnel | ___ | 22 | ___% |
| Configuration | ___ | 16 | ___% |
| Documentation | ___ | 9 | ___% |
| Legal | ___ | 9 | ___% |
| **TOTAL** | **___** | **101** | **___%** |

---

## 🎯 Critères de lancement

### Minimum requis (GO/NO-GO)

**🔴 BLOQUANT (100% requis)**
- [ ] Score Sécurité ≥ 18/20 (90%)
- [ ] Score Fonctionnel ≥ 20/22 (91%)
- [ ] Stripe en mode Live
- [ ] Backups Supabase vérifiés
- [ ] Leaked Password Protection activé

**🟠 CRITIQUE (Recommandé 100%)**
- [ ] Score Performance ≥ 12/15 (80%)
- [ ] Score Tests ≥ 8/10 (80%)
- [ ] Score Configuration ≥ 14/16 (88%)

**🟡 IMPORTANT (Recommandé 80%)**
- [ ] Score Documentation ≥ 7/9 (78%)
- [ ] Score Legal ≥ 7/9 (78%)

### Décision finale

**Score global minimum : 85/101 (84%)**

- [ ] ✅ **GO PRODUCTION** - Tous les critères respectés
- [ ] 🟡 **GO avec réserves** - Critères critiques OK, améliorer importance
- [ ] ❌ **NO GO** - Critères bloquants non respectés

---

## 📝 Notes & Actions

### Actions avant lancement

1. _______________________________________
2. _______________________________________
3. _______________________________________

### Actions post-lancement (J+7)

1. _______________________________________
2. _______________________________________
3. _______________________________________

---

## ✍️ Signatures

**Validation technique** : _________________ Date : _______

**Validation business** : _________________ Date : _______

**Validation sécurité** : _________________ Date : _______

---

*Checklist v1.0.0 - 18 octobre 2025*
