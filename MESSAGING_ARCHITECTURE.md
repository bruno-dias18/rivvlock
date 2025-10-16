# Architecture de Messagerie Unifiée RivvLock

## Vue d'ensemble

RivvLock utilise une architecture de messagerie unifiée basée sur une table centrale `conversations` qui gère tous les types de conversations : transactions, devis, et litiges.

## Structure de la base de données

### Table `conversations`
Table centrale qui regroupe tous les types de conversations :
- `id` (uuid) - Identifiant unique de la conversation
- `seller_id` (uuid) - ID du vendeur/prestataire
- `buyer_id` (uuid, nullable) - ID de l'acheteur/client
- `transaction_id` (uuid, nullable) - Lien vers une transaction
- `quote_id` (uuid, nullable) - Lien vers un devis
- `dispute_id` (uuid, nullable) - Lien vers un litige
- `status` (text) - Statut de la conversation ('active', 'archived', etc.)

**Contrainte importante** : Un index unique sur `transaction_id` garantit qu'une transaction ne peut avoir qu'une seule conversation.

### Table `messages`
Table qui stocke tous les messages :
- `id` (uuid) - Identifiant unique du message
- `conversation_id` (uuid) - Lien vers la conversation
- `sender_id` (uuid) - ID de l'expéditeur
- `message` (text) - Contenu du message
- `message_type` (text) - Type de message ('text', 'system', 'proposal_update')
- `metadata` (jsonb, nullable) - Métadonnées additionnelles

**Index de performance** :
- `idx_messages_conversation_id_created_at` - Optimise les requêtes de messages par conversation

## Architecture Frontend

### Composant principal : `UnifiedMessaging`
Composant unique qui gère toutes les conversations, quelle que soit leur source.

**Props** :
- `conversationId` - ID de la conversation à afficher
- `open` / `onOpenChange` - Contrôle d'ouverture du dialog
- `otherParticipantName` - Nom de l'autre participant
- `title` - Titre personnalisé de la conversation

### Composants wrapper spécialisés

#### `TransactionMessaging`
Gère les conversations de transactions :
1. Récupère le `conversation_id` depuis la transaction
2. Si aucune conversation n'existe, appelle l'edge function `ensure-transaction-conversation`
3. Délègue l'affichage à `UnifiedMessaging`

#### `QuoteMessaging`
Gère les conversations de devis :
1. Récupère le `conversation_id` depuis le devis
2. Délègue l'affichage à `UnifiedMessaging`

### Hooks personnalisés

#### `useConversation(conversationId)`
Hook principal pour gérer une conversation :
- Charge les messages de la conversation
- Gère l'envoi de messages
- S'abonne aux mises à jour en temps réel via Supabase Realtime
- Polling fallback toutes les 10 secondes si Realtime échoue

#### `useUnreadConversationMessages(conversationId)`
Compte les messages non lus d'une conversation :
- Utilise `localStorage` pour stocker le timestamp de dernière lecture (`conversation_seen_${conversationId}`)
- Compare avec `created_at` des messages pour déterminer les non-lus

#### `useMarkConversationAsRead()`
Marque une conversation comme lue :
- Met à jour le timestamp dans `localStorage`
- Invalide tous les compteurs de messages non lus

## Edge Functions

### `ensure-transaction-conversation`
**Rôle** : Crée une conversation pour une transaction si elle n'existe pas déjà.

**Sécurité** :
- Vérifie que l'utilisateur est participant de la transaction
- Vérifie qu'un acheteur est assigné
- Utilise `SECURITY DEFINER` pour bypasser RLS lors de l'insertion

**Logique** :
1. Vérifie si une conversation existe déjà
2. Si oui, retourne son ID
3. Si non, crée une nouvelle conversation et met à jour `transactions.conversation_id`

## Sécurité (RLS)

### Policies `conversations`
- **SELECT** : Les participants (seller_id, buyer_id) peuvent voir leurs conversations + admins
- **Pas d'INSERT/UPDATE/DELETE public** : Seuls les edge functions et admins peuvent créer/modifier

### Policies `messages`
- **SELECT** : Les participants de la conversation peuvent voir les messages + admins
- **INSERT** : Les participants peuvent envoyer des messages
- **Pas de DELETE** : Les messages ne peuvent pas être supprimés

## Optimisations

### Index de performance créés
- `idx_conversations_seller_id` - Accélère les recherches par vendeur
- `idx_conversations_buyer_id` - Accélère les recherches par acheteur
- `idx_conversations_transaction_id_unique` - Index unique pour garantir 1 conversation par transaction
- `idx_messages_conversation_id_created_at` - Optimise les requêtes de messages
- `idx_transactions_conversation_id` - Accélère les recherches de transactions par conversation

### Optimisations frontend
- Realtime WebSocket pour les mises à jour instantanées
- Polling fallback pour la résilience
- Optimistic updates pour l'envoi de messages
- Cache React Query avec `staleTime` approprié

## Migration et nettoyage

### Backfill initial
Migration `20251016141745_c5e24bb9-1866-4015-9c82-364510e9b07a.sql` :
- Crée des conversations pour toutes les transactions existantes sans `conversation_id`
- Met à jour `transactions.conversation_id` pour pointer vers la conversation créée

### Nettoyage des doublons
Migration de nettoyage ultérieure :
- Supprime les conversations en double (garde la plus ancienne par `created_at`)
- Resynchronise `transactions.conversation_id` vers la bonne conversation
- Crée l'index unique `idx_conversations_transaction_id_unique` pour empêcher les futurs doublons

## Flux typique d'utilisation

### Création d'une nouvelle transaction avec messagerie
1. Transaction créée dans `transactions`
2. Acheteur rejoint via token ou lien
3. Premier clic sur "Messages" déclenche `TransactionMessaging`
4. `TransactionMessaging` appelle `ensure-transaction-conversation`
5. Edge function crée la conversation et met à jour `transactions.conversation_id`
6. `UnifiedMessaging` s'affiche avec la conversation

### Envoi d'un message
1. Utilisateur tape un message dans `UnifiedMessaging`
2. Appel à `sendMessage` du hook `useConversation`
3. Message inséré dans `messages` via Supabase client
4. Realtime WebSocket notifie tous les clients connectés
5. Message apparaît instantanément (optimistic update) + confirmation Realtime

### Comptage des non-lus
1. Hook `useUnreadConversationMessages` lit le timestamp depuis `localStorage`
2. Requête Supabase compte les messages avec `created_at > lastSeen`
3. Badge de notification mis à jour en temps réel
4. Quand l'utilisateur ouvre la conversation, `markAsRead` met à jour le timestamp

## Points d'attention

### Cas particuliers
- **Transaction sans acheteur** : La conversation ne peut être créée que si `buyer_id` est assigné
- **Devis non acceptés** : La conversation existe dès la création du devis, même si le client n'a pas encore accepté
- **Litiges** : Utilisent encore `dispute_messages` (table séparée) pour des raisons historiques et de sécurité

### Évolutions futures possibles
- Migrer `dispute_messages` vers le système unifié
- Ajouter le support de pièces jointes dans les messages
- Ajouter la recherche dans les messages
- Système de notifications push pour les messages non lus

---

**Date de création** : Octobre 2025  
**Dernière mise à jour** : Optimisations de performance et nettoyage des doublons
