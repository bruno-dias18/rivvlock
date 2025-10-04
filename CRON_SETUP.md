# Configuration du Cron Externe pour la Finalisation Automatique

## Vue d'ensemble

Ce guide explique comment configurer un service externe de cron pour appeler automatiquement la fonction edge `process-validation-deadline` toutes les 10 minutes. Cette fonction finalise automatiquement les transactions dont le délai de validation (48h) a expiré.

## Pourquoi un cron externe ?

Les cron jobs configurés dans `supabase/config.toml` ne fonctionnent que dans l'environnement de développement local. En production, Supabase ne les exécute pas automatiquement. Il faut donc utiliser un service externe pour déclencher la fonction périodiquement.

## Service recommandé : cron-job.org

### Étape 1 : Créer un compte

1. Aller sur [https://cron-job.org](https://cron-job.org)
2. Créer un compte gratuit (permet jusqu'à 25 cron jobs)
3. Confirmer l'email et se connecter

### Étape 2 : Créer un nouveau cron job

1. Cliquer sur **"Create cronjob"**
2. Configurer les paramètres suivants :

#### Configuration de base

- **Title** : `RivvLock - Process Validation Deadlines`
- **Address (URL)** : `https://slthyxqruhfuyfmextwr.supabase.co/functions/v1/process-validation-deadline`

#### Planification

- **Schedule** : Sélectionner "Every 10 minutes"
- **Timezone** : Choisir votre fuseau horaire (ex: `Europe/Paris`)

#### Configuration avancée

1. Dans l'onglet **"Advanced"**, ajouter les headers HTTP suivants :

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsdGh5eHFydWhmdXlmbWV4dHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxODIxMzcsImV4cCI6MjA3Mzc1ODEzN30.QFrsO1ThBjlQ_WRFGSHz-Pc3Giot1ijgUqSHVLykGW0
Content-Type: application/json
```

2. **Request method** : `POST`
3. **Request timeout** : `30` secondes

#### Notifications (optionnel)

- Cocher **"Send notifications on execution failure"**
- Entrer votre email pour recevoir des alertes en cas d'erreur

### Étape 3 : Sauvegarder et activer

1. Cliquer sur **"Create cronjob"**
2. Vérifier que le statut est "Enabled" (activé)

## Services alternatifs

### EasyCron

[https://www.easycron.com](https://www.easycron.com)

Configuration similaire :
- URL : `https://slthyxqruhfuyfmextwr.supabase.co/functions/v1/process-validation-deadline`
- Interval : `*/10 * * * *` (toutes les 10 minutes)
- Headers : Identiques à cron-job.org

### UptimeRobot (Monitor + Heartbeat)

[https://uptimerobot.com](https://uptimerobot.com)

Bien que principalement un service de monitoring, UptimeRobot peut être configuré pour appeler une URL toutes les 5 minutes (plan gratuit).

## Vérification du fonctionnement

### 1. Via les logs Supabase

Aller dans le dashboard Supabase :
```
https://supabase.com/dashboard/project/slthyxqruhfuyfmextwr/functions/process-validation-deadline/logs
```

Vous devriez voir des logs toutes les 10 minutes indiquant :
- `🕐 [PROCESS-VALIDATION-DEADLINE] Starting deadline processing`
- Le nombre de transactions traitées

### 2. Via le bouton admin manuel

Dans l'interface admin de RivvLock :
1. Aller sur la page Admin
2. Dans la section "Paramètres système"
3. Le bouton "Traiter les validations expirées" affiche le nombre de transactions en attente
4. Si le nombre est toujours > 0 après plusieurs cycles de cron, vérifier les logs

### 3. Vérifier dans la base de données

```sql
SELECT 
  id,
  title,
  validation_deadline,
  seller_validated,
  buyer_validated,
  funds_released,
  status
FROM transactions
WHERE 
  seller_validated = true
  AND buyer_validated = false
  AND funds_released = false
  AND validation_deadline IS NOT NULL
  AND validation_deadline < NOW()
  AND status = 'paid';
```

Si cette requête retourne des résultats, c'est que le cron ne fonctionne pas correctement.

## Dépannage

### Le cron ne s'exécute pas

1. **Vérifier les headers** : Le header `Authorization` est obligatoire
2. **Vérifier l'URL** : Doit être exactement `https://slthyxqruhfuyfmextwr.supabase.co/functions/v1/process-validation-deadline`
3. **Vérifier le statut** : Le cron job doit être "Enabled"

### Le cron s'exécute mais ne traite rien

1. Vérifier les logs de la fonction edge
2. Vérifier que les transactions ont bien `seller_validated = true` et `validation_deadline` dans le passé
3. Tester manuellement via le bouton admin

### Erreur d'authentification

Si vous voyez des erreurs 401 (Unauthorized) :
- Vérifier que le header `Authorization` contient bien le token anon
- Le token doit commencer par `Bearer eyJ...`

## Sécurité

### Headers sensibles

Le token `Authorization` est un token **anon** (anonyme) de Supabase. Il permet uniquement :
- D'appeler les fonctions edge publiques
- Il ne donne **pas** accès aux données privées grâce aux RLS policies

### Rotation du token

Si le token doit être changé (ex: suite à une compromission) :
1. Générer un nouveau token anon dans Supabase
2. Mettre à jour le header dans le service de cron
3. Mettre à jour `src/integrations/supabase/client.ts`

## Maintenance

### Monitoring recommandé

- Configurer des alertes email en cas d'échec du cron
- Vérifier les logs Supabase une fois par semaine
- Vérifier que le nombre de transactions "expirées" reste à 0

### Que faire si le service de cron tombe en panne ?

1. Utiliser le bouton admin manuel pour traiter les transactions en attente
2. Configurer un service de cron alternatif en backup
3. Contacter le support du service de cron

## Coût

- **cron-job.org** : Gratuit jusqu'à 25 cron jobs
- **EasyCron** : Gratuit pour les crons basiques
- **UptimeRobot** : Gratuit jusqu'à 50 moniteurs (intervalle min: 5 minutes)

## Contact et support

En cas de problème :
1. Vérifier les logs Supabase
2. Tester manuellement via le bouton admin
3. Contacter le support du service de cron utilisé
