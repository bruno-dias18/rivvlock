# Bonnes pratiques - Architecture des litiges

## 🎯 Règles d'or (à TOUJOURS respecter)

### 1. Création de litiges

#### ✅ TOUJOURS garantir la création de conversation

```typescript
// ❌ MAUVAIS - Peut créer des litiges orphelins
await supabase.from('disputes').insert({ 
  transaction_id, 
  reporter_id, 
  reason 
});

// ✅ BON - Utiliser l'edge function qui garantit la conversation
const { data } = await supabase.functions.invoke('create-dispute', {
  body: { transactionId, disputeType, reason }
});
```

**Pourquoi ?** L'edge function a une logique à 3 niveaux qui garantit qu'une conversation sera TOUJOURS créée ou liée.

### 2. Affichage de litiges

#### ✅ TOUJOURS utiliser le hook unifié avec fallbacks

```typescript
// ❌ MAUVAIS - Requête directe sans fallbacks
const { data } = await supabase
  .from('disputes')
  .select('*')
  .not('conversation_id', 'is', null); // Peut cacher des litiges orphelins

// ✅ BON - Hook avec fallbacks automatiques
const { data: disputes } = useDisputes(); // = useDisputesUnified
```

**Pourquoi ?** `useDisputesUnified` a 3 niveaux de fallback pour garantir qu'aucun litige n'est jamais caché.

### 3. Comptage de litiges (badges)

#### ✅ TOUJOURS inclure les litiges potentiellement orphelins

```typescript
// ❌ MAUVAIS - Peut sous-compter
const { data } = await supabase
  .from('disputes')
  .select('id')
  .not('conversation_id', 'is', null)
  .not('status', 'in', '(resolved,resolved_refund,resolved_release)');

// ✅ BON - Compte TOUS les litiges actifs
const { unreadCount } = useUnreadDisputesGlobal();
```

**Pourquoi ?** Le hook `useUnreadDisputesGlobal` compte tous les litiges actifs, même ceux temporairement orphelins.

### 4. Messagerie de litiges

#### ✅ TOUJOURS vérifier la présence de conversation_id avant affichage

```typescript
// ❌ MAUVAIS - Peut causer une erreur si conversation_id = null
<UnifiedMessaging conversationId={dispute.conversation_id} />

// ✅ BON - Affichage conditionnel
{dispute.conversation_id && (
  <UnifiedMessaging conversationId={dispute.conversation_id} />
)}

// ✅ ENCORE MIEUX - Afficher quand même le litige, cacher seulement la messagerie
{dispute.conversation_id ? (
  <Button onClick={() => setShowMessaging(true)}>Voir la discussion</Button>
) : (
  <Alert>
    <AlertDescription>
      Messagerie temporairement indisponible. Contactez le support.
    </AlertDescription>
  </Alert>
)}
```

**Pourquoi ?** Le litige reste visible et utilisable même sans messagerie fonctionnelle.

### 5. Escalade de litiges

#### ✅ TOUJOURS utiliser la fonction edge dédiée

```typescript
// ❌ MAUVAIS - Création manuelle de conversations admin
await supabase.from('conversations').insert({
  dispute_id, admin_id, conversation_type: 'admin_seller_dispute'
});

// ✅ BON - Utiliser la fonction dédiée
await supabase.rpc('create_escalated_dispute_conversations', {
  p_dispute_id: disputeId,
  p_admin_id: adminId
});
```

**Pourquoi ?** La fonction RPC garantit :
- Création atomique des 2 conversations (seller + buyer)
- Pas de duplication
- Intégrité des liens dispute_id

## 🔧 Patterns à suivre

### Pattern 1 : Création sécurisée

```typescript
// Composant React
const handleCreateDispute = async () => {
  try {
    // 1. Validation côté client
    if (!reason || reason.length < 10) {
      toast.error("Raison trop courte");
      return;
    }

    // 2. Appel edge function (garantie conversation)
    const { data, error } = await supabase.functions.invoke('create-dispute', {
      body: { transactionId, disputeType, reason }
    });

    if (error) throw error;

    // 3. Rafraîchir les données locales
    queryClient.invalidateQueries(['disputes']);
    queryClient.invalidateQueries(['unread-disputes-global']);

    // 4. Feedback utilisateur
    toast.success("Litige créé avec succès");
    
    // 5. Redirection ou callback
    onDisputeCreated?.(data.disputeId);
  } catch (error) {
    logger.error('Create dispute failed:', error);
    toast.error("Erreur lors de la création du litige");
  }
};
```

### Pattern 2 : Affichage résilient

```typescript
// Hook personnalisé pour affichage
const useDisputeDisplay = (dispute: Dispute) => {
  const { user } = useAuth();
  const transaction = dispute.transactions;

  // Déterminer le rôle de l'utilisateur
  const userRole = useMemo(() => {
    if (!transaction) return null;
    if (transaction.user_id === user?.id) return 'seller';
    if (transaction.buyer_id === user?.id) return 'buyer';
    return null;
  }, [transaction, user]);

  // Déterminer si la messagerie est disponible
  const canShowMessaging = useMemo(() => {
    if (dispute.status.startsWith('resolved')) return false;
    if (dispute.status === 'escalated') return true; // Conversations admin
    return !!dispute.conversation_id; // Conversation publique
  }, [dispute]);

  return { userRole, canShowMessaging };
};
```

### Pattern 3 : Gestion d'erreur gracieuse

```typescript
// Composant DisputeCard
const DisputeCard = ({ dispute, onRefetch }) => {
  const { canShowMessaging } = useDisputeDisplay(dispute);
  const [showMessaging, setShowMessaging] = useState(false);

  // Fallback si pas de transaction
  if (!dispute.transactions) {
    return (
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle>Litige #{dispute.id.slice(0, 8)}</CardTitle>
          <Badge variant="destructive">Données incomplètes</Badge>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              Les détails de ce litige sont temporairement indisponibles.
              Contactez le support avec la référence : {dispute.id}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {/* Contenu normal */}
      
      {canShowMessaging ? (
        <Button onClick={() => setShowMessaging(true)}>
          Voir la discussion
        </Button>
      ) : (
        <Alert>
          <AlertDescription>
            Messagerie temporairement indisponible.
          </AlertDescription>
        </Alert>
      )}
    </Card>
  );
};
```

## 🚫 Anti-patterns (à éviter absolument)

### ❌ Anti-pattern 1 : Création manuelle sans garantie

```typescript
// NE JAMAIS FAIRE ÇA
const createDisputeManually = async () => {
  // Crée le dispute mais pas de conversation garantie
  await supabase.from('disputes').insert({ ... });
  
  // Essaie de créer la conversation (peut échouer silencieusement)
  try {
    await supabase.from('conversations').insert({ ... });
  } catch (err) {
    console.log('oups'); // Dispute orphelin créé !
  }
};
```

**Problème :** Si la création de conversation échoue, le dispute devient orphelin et invisible.

**Solution :** Utiliser `supabase.functions.invoke('create-dispute')` qui garantit la conversation.

### ❌ Anti-pattern 2 : Filtrage trop strict

```typescript
// NE JAMAIS FAIRE ÇA
const getDisputes = async () => {
  return await supabase
    .from('disputes')
    .select('*')
    .not('conversation_id', 'is', null) // ❌ Cache les orphelins
    .not('status', 'in', '(resolved,resolved_refund,resolved_release)');
};
```

**Problème :** Les litiges orphelins (même temporaires) deviennent invisibles.

**Solution :** Utiliser `useDisputes()` qui a des fallbacks automatiques.

### ❌ Anti-pattern 3 : Dépendance rigide à conversation_id

```typescript
// NE JAMAIS FAIRE ÇA
const DisputeCard = ({ dispute }) => {
  // Crash si conversation_id = null
  return (
    <div>
      <UnifiedMessaging conversationId={dispute.conversation_id} />
    </div>
  );
};
```

**Problème :** Si `conversation_id` est null, le composant crash ou ne s'affiche pas.

**Solution :** Affichage conditionnel et fallback gracieux.

### ❌ Anti-pattern 4 : Modification directe sans triggers

```typescript
// NE JAMAIS FAIRE ÇA
const linkConversationManually = async (disputeId, conversationId) => {
  // Met à jour dispute.conversation_id mais pas conversation.dispute_id
  await supabase
    .from('disputes')
    .update({ conversation_id: conversationId })
    .eq('id', disputeId);
  // ❌ Incohérence : conversation.dispute_id reste null
};
```

**Problème :** Crée une incohérence bidirectionnelle.

**Solution :** Les triggers se chargent automatiquement de la synchronisation. Si besoin de forcer, utiliser `adminClient` et mettre à jour les deux.

## 📊 Checklist de validation avant déploiement

### Nouveau code touchant les litiges

- [ ] Utilise `supabase.functions.invoke('create-dispute')` pour créer des litiges
- [ ] Utilise `useDisputes()` pour afficher les litiges
- [ ] Utilise `useUnreadDisputesGlobal()` pour les badges
- [ ] Affiche les litiges même si `conversation_id` est null
- [ ] Cache seulement la messagerie si pas de conversation
- [ ] Gère les erreurs avec des fallbacks gracieux
- [ ] Log les erreurs avec `logger.error()` pour monitoring
- [ ] Invalide les caches React Query après mutation

### Nouvelle feature d'escalade

- [ ] Utilise `create_escalated_dispute_conversations()` RPC
- [ ] Gère les 2 conversations séparées (admin-seller, admin-buyer)
- [ ] Bloque les messages publics post-escalade
- [ ] Affiche un message clair à l'utilisateur
- [ ] Met à jour le statut du dispute à 'escalated'

### Tests de non-régression

- [ ] Créer un litige → vérifier `conversation_id` non-null
- [ ] Badge "Litiges (X)" → vérifier comptage correct
- [ ] Liste des litiges → tous les litiges actifs affichés
- [ ] Messagerie → fonctionne correctement
- [ ] Escalade → conversations admin créées
- [ ] Archivage → litige reste visible pour l'autre partie

## 🔍 Debugging rapide

### Litige invisible dans l'UI

```sql
-- 1. Vérifier si le litige existe
SELECT id, status, conversation_id, transaction_id 
FROM disputes 
WHERE id = '<DISPUTE_ID>';

-- 2. Si conversation_id est null, réparer
SELECT * FROM public.repair_orphan_disputes();

-- 3. Vérifier la transaction
SELECT id, user_id, buyer_id, status 
FROM transactions 
WHERE id = '<TRANSACTION_ID>';
```

### Badge compteur incorrect

```typescript
// Console du navigateur
// 1. Vérifier les données du hook
const { unreadCount, refetch } = useUnreadDisputesGlobal();
console.log('Badge count:', unreadCount);

// 2. Forcer le rafraîchissement
refetch();

// 3. Vérifier les filtres d'archivage
// Le badge ne compte PAS les litiges archivés par l'utilisateur
```

### Messagerie ne s'affiche pas

```typescript
// Console du navigateur
console.log('Dispute:', dispute);
console.log('conversation_id:', dispute.conversation_id);
console.log('status:', dispute.status);

// Si conversation_id = null
// → Exécuter repair_orphan_disputes()

// Si escalated = true
// → Vérifier les conversations admin avec useEscalatedDisputeConversations
```

## 🎓 Ressources

- [DISPUTE_ORPHAN_REPAIR_GUIDE.md](./DISPUTE_ORPHAN_REPAIR_GUIDE.md) - Guide de réparation
- [DISPUTE_ARCHITECTURE_AUDIT.md](./DISPUTE_ARCHITECTURE_AUDIT.md) - Audit complet
- [MESSAGING_ARCHITECTURE.md](./MESSAGING_ARCHITECTURE.md) - Architecture unifiée
- [DISPUTE_MIGRATION_TEST_GUIDE.md](./DISPUTE_MIGRATION_TEST_GUIDE.md) - Tests Phase 5

## 🤝 Support

En cas de problème persistant :

1. Exécuter `SELECT * FROM repair_orphan_disputes()`
2. Vérifier les logs frontend (console navigateur)
3. Vérifier les logs PostgreSQL (Supabase Dashboard)
4. Fournir les résultats des requêtes de diagnostic
5. Créer un ticket avec la référence du litige concerné
