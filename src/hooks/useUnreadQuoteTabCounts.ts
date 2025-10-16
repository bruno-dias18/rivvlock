import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface QuoteLike { id: string; conversation_id: string | null; status: string; }

export const useUnreadQuoteTabCounts = (sentQuotes: QuoteLike[], receivedQuotes: QuoteLike[]) => {
  const { user } = useAuth();

  const { data, refetch, isLoading } = useQuery({
    queryKey: [
      'unread-quote-tabs',
      user?.id,
      sentQuotes.map(q => q.id).join(','),
      receivedQuotes.map(q => q.id).join(',')
    ],
    queryFn: async (): Promise<{ sentUnread: number; receivedUnread: number }> => {
      if (!user?.id) return { sentUnread: 0, receivedUnread: 0 };

      const computeForList = async (list: QuoteLike[]) => {
        // Exclure les devis acceptés (notifications gérées par la transaction)
        const activeQuotes = list.filter(q => q.status !== 'accepted');
        const conversationIds = activeQuotes.map(q => q.conversation_id).filter(Boolean) as string[];
        if (conversationIds.length === 0) return 0;

        let total = 0;
        for (const conversationId of conversationIds) {
          const lastSeenKey = `conversation_seen_${conversationId}`;
          const lastSeen = localStorage.getItem(lastSeenKey);

          let query = supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('conversation_id', conversationId)
            .neq('sender_id', user.id);

          if (lastSeen) query = query.gt('created_at', lastSeen);
          const { count } = await query;
          total += count || 0;
        }
        return total;
      };

      const [sentUnread, receivedUnread] = await Promise.all([
        computeForList(sentQuotes),
        computeForList(receivedQuotes)
      ]);

      return { sentUnread, receivedUnread };
    },
    enabled: !!user?.id,
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    refetchOnMount: true, // ✅ Use global config
  });

  return { sentUnread: data?.sentUnread ?? 0, receivedUnread: data?.receivedUnread ?? 0, refetch, isLoading };
};
