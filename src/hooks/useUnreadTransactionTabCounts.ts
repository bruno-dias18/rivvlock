import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface TransactionLike { id: string; conversation_id: string | null; status: string; }

export const useUnreadTransactionTabCounts = (transactions: TransactionLike[]) => {
  const { user } = useAuth();

  const { data, refetch, isLoading } = useQuery({
    queryKey: [
      'unread-transaction-tabs',
      user?.id,
      transactions.map(t => t.id).join(',')
    ],
    queryFn: async (): Promise<{
      pending: number;
      blocked: number;
      disputed: number;
      completed: number;
    }> => {
      if (!user?.id || transactions.length === 0) {
        return { pending: 0, blocked: 0, disputed: 0, completed: 0 };
      }

      // Grouper les transactions par statut
      const pending = transactions.filter(t => t.status === 'pending');
      const blocked = transactions.filter(t => t.status === 'paid');
      const completed = transactions.filter(t => t.status === 'validated');
      
      // Pour disputed, on va compter séparément en regardant la table disputes
      const { data: disputedTransactionIds } = await supabase
        .from('disputes')
        .select('transaction_id')
        .in('transaction_id', transactions.map(t => t.id))
        .not('status', 'in', '(resolved,resolved_refund,resolved_release)');

      const disputedIds = new Set((disputedTransactionIds || []).map(d => d.transaction_id));
      const disputed = transactions.filter(t => disputedIds.has(t.id));

      // Optimized: Single grouped query instead of N queries
      const computeForList = async (list: TransactionLike[]) => {
        const conversationIds = list.map(t => t.conversation_id).filter(Boolean) as string[];
        if (conversationIds.length === 0) return 0;

        // Fetch all messages at once
        const { data: allMessages } = await supabase
          .from('messages')
          .select('conversation_id, id, created_at')
          .in('conversation_id', conversationIds)
          .neq('sender_id', user.id);

        if (!allMessages) return 0;

        // Count unread messages per conversation in memory
        let total = 0;
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

          total += unreadInConv.length;
        }
        return total;
      };

      const [pendingUnread, blockedUnread, disputedUnread, completedUnread] = await Promise.all([
        computeForList(pending),
        computeForList(blocked),
        computeForList(disputed),
        computeForList(completed)
      ]);

      return {
        pending: pendingUnread,
        blocked: blockedUnread,
        disputed: disputedUnread,
        completed: completedUnread
      };
    },
    enabled: !!user?.id,
    staleTime: 5_000, // 5s pour réactivité immédiate des badges
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: 10_000, // Refetch toutes les 10s en backup
  });

  return {
    pending: data?.pending ?? 0,
    blocked: data?.blocked ?? 0,
    disputed: data?.disputed ?? 0,
    completed: data?.completed ?? 0,
    refetch,
    isLoading
  };
};
