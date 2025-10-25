# 📋 Conformité Légale - Rétention des Données

## ⚖️ Cadre Légal

### RGPD (Règlement Européen)
- **Article 5.1.e** : Limitation de la durée de conservation des données personnelles
- **Principe** : Les données ne doivent pas être conservées plus longtemps que nécessaire

### nLPD (Loi Suisse sur la Protection des Données)
- **Article 6 al. 3** : Durée de conservation proportionnée et justifiée
- **Sanctions** : Jusqu'à 250'000 CHF d'amende

### Code de Commerce
- **France (Art. L123-22)** : Conservation des factures pendant 10 ans
- **Suisse (Art. 958f CO)** : Conservation des documents comptables pendant 10 ans

---

## 🔄 Système de Purge Automatique

### Edge Function: `gdpr-data-retention-cleanup`

Une fonction automatisée supprime les données au-delà des durées légales:

| Type de données | Durée de conservation | Base légale |
|----------------|----------------------|-------------|
| Factures (invoices) | 10 ans | Code de commerce |
| Transactions | 10 ans | Code de commerce |
| Litiges (disputes) | 10 ans | Code de commerce |
| Messages | 10 ans | Liés aux transactions |
| Logs d'activité | 1 an | Données opérationnelles |
| Logs d'accès | 1 an | Données de sécurité |

### 📅 Configuration Recommandée

**IMPORTANT**: Vous devez configurer un CRON job pour exécuter cette fonction automatiquement.

#### Option 1: Cron Supabase (Recommandé)
Ajoutez dans votre configuration Supabase Dashboard:
```
Fonction: gdpr-data-retention-cleanup
Fréquence: 0 0 1 * * (1er jour de chaque mois à minuit)
```

#### Option 2: Cron externe (alternatives)
- GitHub Actions avec schedule mensuel
- Service cron externe (cron-job.org, etc.)
- Vercel Cron ou similaire

### 🔧 Test Manuel
Pour tester la fonction:
```bash
# Via Supabase CLI
supabase functions invoke gdpr-data-retention-cleanup --no-verify-jwt

# Via API avec authentification admin
curl -X POST https://[your-project].supabase.co/functions/v1/gdpr-data-retention-cleanup \
  -H "Authorization: Bearer [your-admin-token]"
```

---

## ✅ Checklist de Conformité

### Actions Obligatoires

- [ ] **URGENT**: Ajouter `.env` au `.gitignore` (fichier actuellement exposé sur GitHub)
  - Supprimer `.env` de l'historique Git si nécessaire
  - Regénérer les clés si le repo est public
  
- [ ] **Configurer le CRON** pour exécuter `gdpr-data-retention-cleanup` mensuellement

- [ ] **Documenter dans la Politique de Confidentialité** les durées de conservation
  - Voir `src/pages/PrivacyPolicyPage.tsx` (section déjà présente)

- [ ] **Informer les utilisateurs** des durées de conservation lors de l'inscription

### Actions Recommandées

- [ ] Créer un rapport mensuel des suppressions effectuées
- [ ] Logger les opérations de purge pour audit
- [ ] Tester la fonction avant la mise en production
- [ ] Mettre en place des alertes en cas d'échec de la purge

---

## 🚨 Risques Actuels

### 1. Sécurité GitHub (CRITIQUE)
**Problème**: Le fichier `.env` n'est pas dans le `.gitignore`
**Risque**: Exposition potentielle de secrets si ajoutés par erreur
**Action**: Modifier manuellement `.gitignore` pour ajouter `.env`

### 2. Absence de Purge Automatique (LÉGAL)
**Problème**: Aucun système de suppression après 10 ans
**Risque**: Non-conformité RGPD/nLPD, amendes potentielles
**Action**: Configurer le CRON pour la fonction créée

---

## 📊 Monitoring

### Logs à Surveiller
- Nombre de records supprimés mensuellement
- Échecs de suppression
- Erreurs dans les logs Supabase

### Indicateurs Clés
- Âge moyen des données dans chaque table
- Taux de succès des purges automatiques
- Conformité aux durées légales

---

## 📞 Support

Pour toute question sur la conformité:
- Documentation RGPD: https://gdpr.eu
- Documentation nLPD: https://www.edoeb.admin.ch
- Support Supabase: https://supabase.com/docs

---

**Date de création**: 2025-10-13
**Dernière mise à jour**: 2025-10-13
**Version**: 1.0
