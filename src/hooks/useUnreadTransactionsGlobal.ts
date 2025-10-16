import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

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

      let totalUnread = 0;

      // Pour chaque conversation, compter les messages non lus
      for (const conversationId of conversationIds) {
        const lastSeenKey = `conversation_seen_${conversationId}`;
        const lastSeen = localStorage.getItem(lastSeenKey);

        let query = supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conversationId)
          .neq('sender_id', user.id);

        if (lastSeen) {
          query = query.gt('created_at', lastSeen);
        }

        const { count } = await query;
        totalUnread += count || 0;
      }

      return totalUnread;
    },
    enabled: !!user?.id,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  // Realtime subscription pour tous les messages
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('transactions-global-unread')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload.new as any;
          // Refetch si le message n'est pas de l'utilisateur
          if (row?.sender_id !== user.id) {
            refetch();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refetch]);

  return { unreadCount, refetch, isLoading };
};
