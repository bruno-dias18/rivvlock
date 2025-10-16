import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook pour compter le nombre total de messages non lus dans toutes les transactions de l'utilisateur
 * Utilise le système unifié de conversations et messages
 */
export const useUnreadTransactionsGlobal = () => {
  const { user } = useAuth();

  const { data: unreadCount = 0, refetch, isLoading } = useQuery({
    queryKey: ['unread-transactions-global', user?.id],
    queryFn: async (): Promise<number> => {
      if (!user?.id) return 0;

      // Récupérer toutes les transactions de l'utilisateur (en tant que seller ou buyer)
      const { data: transactions, error: transactionsError } = await supabase
        .from('transactions')
        .select('conversation_id')
        .or(`user_id.eq.${user.id},buyer_id.eq.${user.id}`)
        .not('conversation_id', 'is', null);

      if (transactionsError || !transactions || transactions.length === 0) return 0;

      const conversationIds = transactions
        .map(t => t.conversation_id)
        .filter(Boolean) as string[];

      if (conversationIds.length === 0) return 0;

      // Requête groupée optimisée au lieu de N requêtes
      const { data: allMessages, error } = await supabase
        .from('messages')
        .select('conversation_id, id, created_at')
        .in('conversation_id', conversationIds)
        .neq('sender_id', user.id);

      if (error || !allMessages) return 0;

      // Compter les messages non lus par conversation
      let totalUnread = 0;
      for (const conversationId of conversationIds) {
        const lastSeenKey = `conversation_seen_${conversationId}`;
        const lastSeen = localStorage.getItem(lastSeenKey);

        const unreadInConv = allMessages.filter(msg => {
          if (msg.conversation_id !== conversationId) return false;
          if (!lastSeen) return true;
          // 🔧 Comparaison numérique robuste
          const msgTime = new Date(msg.created_at).getTime();
          const lastSeenTime = new Date(lastSeen).getTime();
          return !Number.isNaN(msgTime) && !Number.isNaN(lastSeenTime) && msgTime > lastSeenTime;
        });

        totalUnread += unreadInConv.length;
      }

      return totalUnread;
    },
    enabled: !!user?.id,
    staleTime: 5_000, // 5s pour réactivité immédiate
    gcTime: 5 * 60_000,
    refetchOnMount: true,
    refetchInterval: 10_000, // Refetch toutes les 10s en backup
  });

  return { unreadCount, refetch, isLoading };
};
