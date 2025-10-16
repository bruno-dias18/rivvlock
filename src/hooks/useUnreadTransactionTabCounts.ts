import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

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

      const computeForList = async (list: TransactionLike[]) => {
        const conversationIds = list.map(t => t.conversation_id).filter(Boolean) as string[];
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
    staleTime: 10_000,
    gcTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!user?.id) return;
    const convIds = new Set(
      transactions.map(t => t.conversation_id).filter(Boolean) as string[]
    );

    const channel = supabase
      .channel('unread-transaction-tabs-realtime')
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
  }, [user?.id, transactions, refetch]);

  return {
    pending: data?.pending ?? 0,
    blocked: data?.blocked ?? 0,
    disputed: data?.disputed ?? 0,
    completed: data?.completed ?? 0,
    refetch,
    isLoading
  };
};
