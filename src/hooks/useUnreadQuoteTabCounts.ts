import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface QuoteLike { 
  id: string; 
  conversation_id: string | null; 
  status: string;
  updated_at?: string;
  client_last_viewed_at?: string | null;
}

export const useUnreadQuoteTabCounts = (sentQuotes: QuoteLike[], receivedQuotes: QuoteLike[]) => {
  const { user } = useAuth();

  const { data, refetch, isLoading } = useQuery({
    queryKey: [
      'unread-quote-tabs',
      user?.id,
      sentQuotes.map(q => `${q.id}-${q.updated_at}-${q.client_last_viewed_at}`).join(','),
      receivedQuotes.map(q => `${q.id}-${q.updated_at}-${q.client_last_viewed_at}`).join(',')
    ],
    queryFn: async (): Promise<{ sentUnread: number; receivedUnread: number }> => {
      if (!user?.id) return { sentUnread: 0, receivedUnread: 0 };

      const computeForList = async (list: QuoteLike[], isSent: boolean) => {
        // Exclure les devis acceptés (notifications gérées par la transaction)
        const activeQuotes = list.filter(q => q.status !== 'accepted');
        if (activeQuotes.length === 0) return 0;

        let totalUnread = 0;
        const nowIso = new Date().toISOString();

        // Pour les devis reçus: compter les devis modifiés non vus
        if (!isSent) {
          const modifiedQuotes = activeQuotes.filter(q => {
            if (!q.updated_at) return false;
            const hasBeenModified = !q.client_last_viewed_at || 
              new Date(q.updated_at).getTime() > new Date(q.client_last_viewed_at).getTime();
            return hasBeenModified;
          });
          totalUnread += modifiedQuotes.length;
        }

        // Compter les messages non lus dans les conversations
        const conversationIds = activeQuotes.map(q => q.conversation_id).filter(Boolean) as string[];
        if (conversationIds.length > 0) {
          // Fetch conversation_reads pour tous les conversationIds en 1 requête
          const { data: reads } = await supabase
            .from('conversation_reads')
            .select('conversation_id, last_read_at')
            .eq('user_id', user.id)
            .in('conversation_id', conversationIds);

          // Construire Map(conversationId → last_read_at)
          const lastReadMap = new Map(reads?.map(r => [r.conversation_id, r.last_read_at]) ?? []);

          // Fetch tous les messages en 1 requête
          const { data: allMessages } = await supabase
            .from('messages')
            .select('conversation_id, id, created_at')
            .in('conversation_id', conversationIds)
            .neq('sender_id', user.id);

          // Compter les messages non lus
          for (const conversationId of conversationIds) {
            const lastReadAt = lastReadMap.get(conversationId) ?? nowIso;
            const unreadInConv = allMessages?.filter(msg => 
              msg.conversation_id === conversationId && msg.created_at > lastReadAt
            ) ?? [];
            if (unreadInConv.length > 0) {
              totalUnread += 1; // Compter 1 par conversation avec messages non lus
            }
          }
        }

        return totalUnread;
      };

      const [sentUnread, receivedUnread] = await Promise.all([
        computeForList(sentQuotes, true),
        computeForList(receivedQuotes, false)
      ]);

      return { sentUnread, receivedUnread };
    },
    enabled: !!user?.id,
    staleTime: 5_000, // 5s pour réactivité immédiate
    gcTime: 5 * 60_000,
    refetchOnMount: true,
    refetchInterval: 20_000, // Refetch toutes les 20s en backup (realtime prioritaire)
  });

  return { sentUnread: data?.sentUnread ?? 0, receivedUnread: data?.receivedUnread ?? 0, refetch, isLoading };
};
