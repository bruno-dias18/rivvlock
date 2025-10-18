# Guide de Déploiement RivvLock

## Date : 18 octobre 2025

## 📋 Table des matières

1. [Prérequis](#prérequis)
2. [Configuration Initiale](#configuration-initiale)
3. [Variables d'Environnement](#variables-denvironnement)
4. [Déploiement Lovable](#déploiement-lovable)
5. [Configuration Production](#configuration-production)
6. [Monitoring Post-Déploiement](#monitoring-post-déploiement)
7. [Rollback Procédure](#rollback-procédure)
8. [FAQ](#faq)

---

## Prérequis

### Comptes requis
- ✅ Compte Lovable actif
- ✅ Compte Supabase avec projet configuré
- ✅ Compte Stripe (mode production activé)
- ✅ Compte GitHub connecté à Lovable
- ✅ Compte Resend pour emails

### Vérifications pré-déploiement

```bash
# 1. Tests locaux
npm run test
npm run build

# 2. Tests Edge Functions
deno test supabase/functions/_shared/__tests__/

# 3. Vérification TypeScript
npm run type-check

# 4. Audit de sécurité
npm audit --audit-level=moderate
```

---

## Configuration Initiale

### 1. Connexion GitHub

1. Ouvrir le projet dans Lovable
2. Cliquer sur **GitHub** → **Connect to GitHub**
3. Autoriser l'application Lovable
4. Créer un nouveau repository ou connecter un existant

### 2. Configuration Supabase

#### A. Variables de production

Dans Supabase Dashboard → Settings → API :

```bash
SUPABASE_URL=https://slthyxqruhfuyfmextwr.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### B. Secrets Edge Functions

Dans Supabase Dashboard → Edge Functions → Manage secrets :

```bash
STRIPE_SECRET_KEY=sk_live_...
RESEND_API_KEY=re_...
```

#### C. Activer Leaked Password Protection

1. Aller dans **Authentication** → **Settings**
2. Activer **"Leaked Password Protection"** ⚠️ **CRITIQUE**
3. Sauvegarder

---

## Variables d'Environnement

### Variables publiques (.env)

```bash
# Supabase
VITE_SUPABASE_URL=https://slthyxqruhfuyfmextwr.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
VITE_SUPABASE_PROJECT_ID=slthyxqruhfuyfmextwr

# Application
VITE_APP_URL=https://rivvlock.lovable.app
```

### Secrets Supabase (Edge Functions)

```bash
# Stripe
STRIPE_SECRET_KEY=sk_live_...

# Resend
RESEND_API_KEY=re_...

# Supabase (auto-injectés)
SUPABASE_URL=https://slthyxqruhfuyfmextwr.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
SUPABASE_ANON_KEY=eyJhbG...
```

---

## Déploiement Lovable

### Méthode 1 : Via GitHub (Recommandé)

```bash
# 1. Commit et push sur main
git add .
git commit -m "chore: prepare production deployment"
git push origin main

# 2. Lovable déploie automatiquement
# Surveiller dans Lovable Dashboard
```

### Méthode 2 : Via Interface Lovable

1. Ouvrir le projet dans Lovable
2. Cliquer sur **Publish** (en haut à droite)
3. Confirmer le déploiement
4. Attendre la fin du build (~2-3 minutes)

### URL de production

```
https://rivvlock.lovable.app
```

---

## Configuration Production

### 1. Stripe Configuration

#### A. Passer en mode Live

1. Dashboard Stripe → **Developers** → **API keys**
2. Copier la clé secrète **Live**
3. Mettre à jour dans Supabase Secrets

#### B. Configurer les Webhooks

```
URL du webhook: https://slthyxqruhfuyfmextwr.supabase.co/functions/v1/stripe-webhook
Événements à écouter:
- payment_intent.succeeded
- payment_intent.payment_failed
- charge.refunded
```

#### C. Customer Portal

1. Aller dans **Settings** → **Customer portal**
2. Activer le portail client
3. Configurer l'URL de retour : `https://rivvlock.lovable.app`

### 2. Configuration Email (Resend)

#### Domaine vérifié

1. Dashboard Resend → **Domains**
2. Ajouter `rivvlock.com` (ou votre domaine)
3. Configurer les enregistrements DNS :
   - SPF
   - DKIM
   - DMARC

#### Template emails

Vérifier que tous les templates sont configurés :
- ✅ Transaction créée
- ✅ Paiement reçu
- ✅ Validation requise
- ✅ Rappels de paiement
- ✅ Litige créé

### 3. Supabase RLS Policies

Vérifier toutes les policies RLS :

```sql
-- Vérifier les policies
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  permissive
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### 4. Cron Jobs

Activer les tâches planifiées dans Supabase :

```sql
-- Rappels de paiement (toutes les heures)
SELECT cron.schedule(
  'send-payment-reminders',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url:='https://slthyxqruhfuyfmextwr.supabase.co/functions/v1/send-payment-reminders',
    headers:='{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  );
  $$
);

-- Traitement des litiges expirés (toutes les 6 heures)
SELECT cron.schedule(
  'process-dispute-deadlines',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url:='https://slthyxqruhfuyfmextwr.supabase.co/functions/v1/process-dispute-deadlines',
    headers:='{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  );
  $$
);
```

---

## Monitoring Post-Déploiement

### 1. Logs Supabase

```bash
# Logs Edge Functions
https://supabase.com/dashboard/project/slthyxqruhfuyfmextwr/logs/edge-functions

# Logs Database
https://supabase.com/dashboard/project/slthyxqruhfuyfmextwr/logs/postgres-logs

# Logs Auth
https://supabase.com/dashboard/project/slthyxqruhfuyfmextwr/logs/auth-logs
```

### 2. Stripe Dashboard

Surveiller :
- Paiements réussis/échoués
- Remboursements
- Disputes/chargebacks
- Taux de conversion

### 3. Métriques Application

Dans le code, le monitoring est déjà configuré :

```typescript
import { performanceMonitor } from '@/lib/monitoring';

// Voir les métriques
console.log(performanceMonitor.getSummary());
```

### 4. Checklist Post-Déploiement

**Jour 1** :
- [ ] Vérifier que l'application charge correctement
- [ ] Tester la création d'un compte
- [ ] Tester la création d'une transaction
- [ ] Tester le paiement Stripe
- [ ] Vérifier les emails

**Jour 2-7** :
- [ ] Surveiller les logs d'erreurs
- [ ] Vérifier les performances (temps de chargement)
- [ ] Analyser les métriques Stripe
- [ ] Tester les cron jobs

**Semaine 2** :
- [ ] Audit de sécurité complet
- [ ] Optimisation des requêtes lentes
- [ ] Collecte des retours utilisateurs

---

## Rollback Procédure

### Option 1 : Via Lovable History

1. Ouvrir Lovable Dashboard
2. Aller dans **History**
3. Sélectionner la version précédente stable
4. Cliquer sur **Restore**

### Option 2 : Via GitHub

```bash
# 1. Identifier le dernier commit stable
git log --oneline

# 2. Créer un revert
git revert <commit-hash>

# 3. Push
git push origin main

# Lovable redéploiera automatiquement
```

### Option 3 : Rollback Database

```sql
-- Lister les migrations
SELECT * FROM supabase_migrations.schema_migrations
ORDER BY version DESC;

-- Rollback si nécessaire (contacter Supabase support)
```

---

## FAQ

### Q : Combien de temps prend un déploiement ?

**R :** 2-3 minutes en moyenne via Lovable.

### Q : Comment gérer les secrets en production ?

**R :** Tous les secrets doivent être dans Supabase Edge Functions Secrets, jamais dans le code.

### Q : Que faire en cas d'erreur 500 ?

**R :** 
1. Vérifier les logs Edge Functions
2. Vérifier les secrets Supabase
3. Tester les endpoints manuellement

### Q : Comment activer HTTPS ?

**R :** HTTPS est automatique sur Lovable et Supabase.

### Q : Peut-on déployer sur un domaine personnalisé ?

**R :** Oui, via Lovable Settings → Domains (plan Pro requis).

### Q : Comment gérer les backups ?

**R :** Supabase fait des backups automatiques quotidiens. Pour restaurer, contacter le support Supabase.

---

## 🚀 Lancement Production

Une fois toutes les étapes complétées :

```bash
# 1. Tag de release
git tag -a v1.0.0 -m "Production release v1.0.0"
git push origin v1.0.0

# 2. Annoncer le lancement
# 3. Surveiller les métriques pendant 24h
# 4. Célébrer ! 🎉
```

---

## Support

- **Documentation Lovable** : https://docs.lovable.dev
- **Documentation Supabase** : https://supabase.com/docs
- **Documentation Stripe** : https://stripe.com/docs

---

*Guide créé le 18 octobre 2025*
*Version 1.0.0*
