# Configuration du Rate Limiting Robuste

## ✅ Implémentation Complète

Le rate limiting robuste est maintenant implémenté avec :
- **Table Supabase dédiée** : `rate_limit_attempts` pour stockage distribué
- **Rate limiter réécrit** : Utilise Supabase au lieu de la mémoire locale
- **Edge function de nettoyage** : `cleanup-rate-limits` pour maintenance

## 📊 Configuration Actuelle

### Limites par défaut
- **Par IP** : 100 requêtes/heure
- **Par utilisateur** : 50 requêtes/heure
- **Fenêtre** : 1 heure glissante

### Avantages
✅ **Distribué** : Fonctionne sur toutes les instances edge functions
✅ **Persistant** : Survit aux redémarrages
✅ **Thread-safe** : Utilise les transactions Supabase
✅ **Monitoring** : Table interrogeable pour analytics

## ⚙️ Configuration du Nettoyage Automatique (Recommandé)

Pour éviter l'accumulation d'anciennes entrées, configurez un cron job Supabase :

### Étape 1 : Activer pg_cron dans Supabase

1. Aller sur [Dashboard Supabase](https://supabase.com/dashboard)
2. Sélectionner votre projet
3. Aller dans **Database** → **Extensions**
4. Activer `pg_cron` et `pg_net`

### Étape 2 : Créer le Cron Job

Exécuter cette requête SQL dans l'éditeur SQL :

```sql
-- Nettoyer les rate limits toutes les heures
SELECT cron.schedule(
  'cleanup-rate-limits-hourly',
  '0 * * * *', -- Toutes les heures à minute 0
  $$
  SELECT net.http_post(
    url := 'https://slthyxqruhfuyfmextwr.supabase.co/functions/v1/cleanup-rate-limits',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsdGh5eHFydWhmdXlmbWV4dHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxODIxMzcsImV4cCI6MjA3Mzc1ODEzN30.QFrsO1ThBjlQ_WRFGSHz-Pc3Giot1ijgUqSHVLykGW0"}'::jsonb,
    body := '{"time": "' || now() || '"}'::jsonb
  ) AS request_id;
  $$
);
```

### Étape 3 : Vérifier le Cron Job

```sql
-- Lister les cron jobs
SELECT * FROM cron.job;

-- Voir l'historique d'exécution
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

## 🔍 Monitoring

### Voir les tentatives actuelles

```sql
SELECT 
  identifier,
  identifier_type,
  attempt_count,
  window_start,
  EXTRACT(EPOCH FROM (NOW() - window_start))/60 as minutes_ago
FROM rate_limit_attempts
ORDER BY updated_at DESC
LIMIT 20;
```

### Identifier les abus potentiels

```sql
SELECT 
  identifier,
  identifier_type,
  attempt_count,
  window_start
FROM rate_limit_attempts
WHERE attempt_count > 80 -- 80% de la limite IP
ORDER BY attempt_count DESC;
```

### Statistiques globales

```sql
SELECT 
  identifier_type,
  COUNT(*) as total_entries,
  AVG(attempt_count) as avg_attempts,
  MAX(attempt_count) as max_attempts
FROM rate_limit_attempts
GROUP BY identifier_type;
```

## ⚡ Personnalisation des Limites

Pour ajuster les limites, éditer `supabase/functions/_shared/rate-limiter.ts` :

```typescript
const RATE_LIMITS = {
  ip: {
    max: 100,        // ← Modifier ici
    windowMs: 60 * 60 * 1000, // 1 heure
  },
  user: {
    max: 50,         // ← Modifier ici
    windowMs: 60 * 60 * 1000,
  },
};
```

## 🚨 Gestion des Alertes

Pour être notifié des abus, créer une alerte Supabase :

```sql
-- Fonction pour détecter les abus
CREATE OR REPLACE FUNCTION notify_rate_limit_abuse()
RETURNS trigger AS $$
BEGIN
  IF NEW.attempt_count >= 95 THEN -- 95% de limite IP
    -- Logger l'événement
    RAISE NOTICE 'Rate limit abuse detected: % (type: %, count: %)', 
      NEW.identifier, NEW.identifier_type, NEW.attempt_count;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger sur mise à jour
CREATE TRIGGER rate_limit_abuse_alert
AFTER INSERT OR UPDATE ON rate_limit_attempts
FOR EACH ROW
EXECUTE FUNCTION notify_rate_limit_abuse();
```

## 📈 Performance

- **Table indexée** sur `identifier` et `window_start`
- **Requêtes optimisées** avec upsert et conditions simples
- **Nettoyage automatique** pour limiter la taille de la table
- **Fail-open** : En cas d'erreur DB, les requêtes passent pour éviter denial of service

## 🔒 Sécurité

- ✅ RLS activé : Seul `service_role` peut accéder
- ✅ Pas d'accès public à la table
- ✅ Rate limiting sur tous les endpoints critiques
- ✅ Protection contre les attaques distribuées (par IP et par user)
