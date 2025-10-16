import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

interface QuoteLike { id: string; conversation_id: string | null; }

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
        const conversationIds = list.map(q => q.conversation_id).filter(Boolean) as string[];
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

  useEffect(() => {
    if (!user?.id) return;
    const convIds = new Set([
      ...sentQuotes.map(q => q.conversation_id).filter(Boolean) as string[],
      ...receivedQuotes.map(q => q.conversation_id).filter(Boolean) as string[],
    ]);

    const channel = supabase
      .channel('unread-quote-tabs-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload.new as any;
          if (row?.sender_id !== user.id && convIds.has(row?.conversation_id)) {
            refetch();
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, sentQuotes, receivedQuotes, refetch]);

  return { sentUnread: data?.sentUnread ?? 0, receivedUnread: data?.receivedUnread ?? 0, refetch, isLoading };
};
