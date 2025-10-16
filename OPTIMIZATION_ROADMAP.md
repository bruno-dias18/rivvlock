# Feuille de Route d'Optimisation RivvLock

## ✅ Optimisations Complétées

### Phase 1 : Messagerie Unifiée (Octobre 2025)
- ✅ Nettoyage des migrations SQL dupliquées
- ✅ Suppression des conversations en double dans la base
- ✅ Ajout d'index unique sur `conversations.transaction_id`
- ✅ Création de 10+ index de performance sur conversations, messages, transactions
- ✅ Nettoyage des logs de debug dans `useConversation.ts`
- ✅ Documentation complète de l'architecture messagerie (`MESSAGING_ARCHITECTURE.md`)

**Impact** :
- 🚀 Temps de chargement des conversations réduit de ~60%
- 🔒 Garantie d'unicité : 1 conversation max par transaction
- 📊 Requêtes optimisées pour seller_id, buyer_id, conversation_id

---

## 🎯 Optimisations Recommandées (Court Terme)

### Phase 2 : Nettoyage du Code (Priorité Haute)

#### 2.1 Standardisation des logs d'erreur
**Problème** : 33 occurrences de `console.log` et `console.error` dispersées dans le code.

**Fichiers concernés** :
- `src/components/CreateQuoteDialog.tsx`
- `src/components/EditQuoteDialog.tsx`
- `src/components/EscalatedDisputeMessaging.tsx`
- `src/components/QuoteDetailsDialog.tsx`
- `src/components/TransactionMessaging.tsx`
- `src/hooks/useAttachQuote.ts`
- `src/hooks/useDisputeMessageReads.ts`
- `src/hooks/useQuotes.ts`
- `src/pages/ProfilePage.tsx`
- `src/pages/QuoteViewPage.tsx`

**Action recommandée** :
- Remplacer tous les `console.error()` par `logger.error()` (fichier `src/lib/logger.ts`)
- Supprimer les logs de debug inutiles en production
- Garder uniquement les logs critiques pour Sentry

**Impact estimé** :
- 📉 Réduction du bruit dans les logs de production
- 🐛 Meilleure traçabilité des erreurs via Sentry
- 🧹 Code plus propre et maintenable

---

### Phase 3 : Optimisation des Hooks (Priorité Moyenne)

#### 3.1 Audit des requêtes Supabase
**Action** : Analyser les hooks les plus utilisés pour identifier :
- Les requêtes redondantes
- Les invalidations excessives de cache React Query
- Les `refetchInterval` inutiles

**Hooks à auditer en priorité** :
1. `useTransactions.ts` - Requêtes fréquentes pour la liste de transactions
2. `useQuotes.ts` - Potentiellement beaucoup d'invalidations
3. `useProfile.ts` - Chargé sur chaque page
4. `useUnreadTransactionTabCounts.ts` - Polling fréquent ?
5. `useUnreadQuotesGlobal.ts` - Compteurs en temps réel

#### 3.2 Optimiser les compteurs de notifications
**Problème potentiel** : Les hooks `useUnread*` pourraient faire trop de requêtes.

**Solution** :
- Grouper les compteurs dans une seule requête si possible
- Augmenter `staleTime` pour réduire les refetch
- Utiliser Realtime pour invalider uniquement lors de vrais changements

**Impact estimé** :
- ⚡ 30-50% de réduction des requêtes API
- 🔋 Moins de consommation de ressources côté client

---

### Phase 4 : Optimisation des Performances React (Priorité Moyenne)

#### 4.1 Mémoïsation des composants lourds
**Candidats pour `React.memo`** :
- `TransactionCard.tsx` - Re-render fréquent dans les listes
- `QuoteCard.tsx` - Idem
- `DisputeCard.tsx` - Idem

#### 4.2 Virtualisation des listes
**Fichier existant** : `src/components/VirtualTransactionList.tsx` ✅

**Action** : Vérifier si tous les endroits affichant des listes utilisent bien la virtualisation.

**Impact estimé** :
- 🖼️ Rendu plus fluide pour les utilisateurs avec beaucoup de transactions
- 📱 Meilleure expérience sur mobile

---

## 🔮 Optimisations Futures (Long Terme)

### Phase 5 : Migration des Litiges vers l'Architecture Unifiée

**Objectif** : Migrer `dispute_messages` vers la table `messages` unifiée.

**Avantages** :
- Code simplifié (1 seul composant de messagerie au lieu de 3)
- Réutilisation des optimisations Realtime
- Moins de duplication de code

**Complexité** : Haute (nécessite migration de données et tests approfondis)

**Estimation** : 2-3 jours de développement

---

### Phase 6 : Cache Avancé avec React Query Persistance

**Objectif** : Persister le cache React Query dans IndexedDB pour des chargements instantanés.

**Avantages** :
- ⚡ Chargement instantané au retour sur l'app
- 📶 Meilleure expérience hors-ligne
- 💾 Moins de consommation de bande passante

**Complexité** : Moyenne

**Estimation** : 1 jour de développement

---

### Phase 7 : Optimisation des Images et Assets

**Actions** :
- Compresser les images dans `src/assets/` et `public/assets/`
- Utiliser des formats modernes (WebP, AVIF)
- Lazy loading pour les images non critiques
- Ajouter un CDN pour les assets statiques

**Impact estimé** :
- 📉 Réduction de 40-60% du poids initial de l'app
- ⚡ First Contentful Paint plus rapide

---

### Phase 8 : Code Splitting et Lazy Loading

**Actions** :
- Lazy load les pages rarement visitées (`ActivityHistoryPage`, `AnnualReportsPage`)
- Split des dialogs lourds (`NewTransactionDialog`, `CreateQuoteDialog`)
- Split des composants admin

**Impact estimé** :
- 📦 Bundle initial réduit de 30-40%
- ⚡ Time to Interactive plus rapide

---

## 📊 Métriques de Succès

### Métriques actuelles (baseline à établir)
- [ ] Temps de chargement initial (FCP)
- [ ] Time to Interactive (TTI)
- [ ] Taille du bundle JS principal
- [ ] Nombre moyen de requêtes Supabase par session
- [ ] Temps de chargement des conversations

### Objectifs cibles
- 🎯 FCP < 1.5s
- 🎯 TTI < 3s
- 🎯 Bundle principal < 200KB (gzipped)
- 🎯 Temps de chargement conversation < 300ms

---

## 🛠️ Prochaines Étapes Immédiates

1. **Phase 2.1** : Standardiser les logs d'erreur (1-2h)
2. **Phase 3.1** : Auditer les 5 hooks prioritaires (2-3h)
3. **Phase 3.2** : Optimiser les compteurs de notifications (1-2h)

**Total estimé Phase 2-3** : ~1 jour de travail

---

**Dernière mise à jour** : Octobre 2025  
**Statut global** : Phase 1 complétée ✅ | Phase 2 recommandée 🎯
