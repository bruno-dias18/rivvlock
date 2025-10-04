import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import { useEffect } from 'react';

/**
 * Hook pour compter les messages non lus d'une transaction
 * Un message est considéré comme non lu si sender_id !== auth.uid()
 */
export function useUnreadTransactionMessages(transactionId: string | undefined) {
  const { user } = useAuth();

  const { data, refetch } = useQuery({
    queryKey: ['unread-transaction-messages', transactionId],
    queryFn: async (): Promise<number> => {
      if (!transactionId || !user?.id) return 0;

      // Get messages not sent by user
      const { data: messages, error } = await supabase
        .from('transaction_messages')
        .select('id')
        .eq('transaction_id', transactionId)
        .neq('sender_id', user.id);

      if (error) {
        logger.error('Error fetching messages:', error);
        return 0;
      }

      if (!messages || messages.length === 0) return 0;

      const messageIds = messages.map(m => m.id);
      
      const { data: reads, error: readsError } = await supabase
        .from('message_reads')
        .select('message_id')
        .in('message_id', messageIds)
        .eq('user_id', user.id);

      if (readsError) {
        logger.error('Error fetching read status:', readsError);
        return messages.length; // Assume all unread on error
      }

      const readMessageIds = new Set(reads?.map(r => r.message_id) || []);
      return messages.filter(m => !readMessageIds.has(m.id)).length;
    },
    enabled: !!transactionId && !!user?.id,
    staleTime: 0,
    gcTime: 30000,
    refetchOnWindowFocus: true,
  });

  const unreadCount: number = data ?? 0;

  // Realtime subscription pour mettre à jour le compteur
  useEffect(() => {
    if (!transactionId || !user?.id) return;

    const channel = supabase
      .channel(`transaction-messages-unread-${transactionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transaction_messages',
        },
        (payload) => {
          // Client-side filter: check transaction_id matches
          if (payload.new && (payload.new as any).transaction_id !== transactionId) {
            return;
          }
          // Refetch seulement si le message n'est pas de l'utilisateur courant
          if (payload.new && (payload.new as any).sender_id !== user.id) {
            refetch();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_reads',
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [transactionId, user?.id, refetch]);

  return { unreadCount, refetch };
}

/**
 * Hook pour compter les transactions avec messages non lus pour un statut donné
 */
export function useUnreadTransactionsCount(transactions: any[]) {
  const { user } = useAuth();

  const { data: unreadTransactionIds = [], refetch } = useQuery({
    queryKey: ['unread-transactions-count', transactions.map(t => t.id).join(',')],
    queryFn: async () => {
      if (!user?.id || transactions.length === 0) return [];

      // Get all messages not sent by user
      const { data: messages, error } = await supabase
        .from('transaction_messages')
        .select('id, transaction_id')
        .in('transaction_id', transactions.map(t => t.id))
        .neq('sender_id', user.id);

      if (error) {
        logger.error('Error fetching messages:', error);
        return [];
      }

      if (!messages || messages.length === 0) return [];

      const messageIds = messages.map(m => m.id);
      
      const { data: reads, error: readsError } = await supabase
        .from('message_reads')
        .select('message_id')
        .in('message_id', messageIds)
        .eq('user_id', user.id);

      if (readsError) {
        logger.error('Error fetching read status:', readsError);
        return [...new Set(messages.map(m => m.transaction_id))];
      }

      const readMessageIds = new Set(reads?.map(r => r.message_id) || []);
      const unreadMessages = messages.filter(m => !readMessageIds.has(m.id));
      
      // Return unique transaction IDs with unread messages
      return [...new Set(unreadMessages.map(m => m.transaction_id))];
    },
    enabled: !!user?.id && transactions.length > 0,
    staleTime: 0,
    gcTime: 30000,
    refetchOnWindowFocus: true,
  });

  // Realtime subscription
  useEffect(() => {
    if (!user?.id || transactions.length === 0) return;

    const channel = supabase
      .channel('transaction-messages-global-unread')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transaction_messages',
        },
        (payload) => {
          // Refetch si le message concerne une transaction suivie et n'est pas de l'utilisateur
          if (payload.new && 
              (payload.new as any).sender_id !== user.id &&
              transactions.some(t => t.id === (payload.new as any).transaction_id)) {
            refetch();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_reads',
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, transactions, refetch]);

  return { unreadTransactionIds, refetch };
}

/**
 * Hook pour compter les messages non lus par catégorie de statut
 */
export function useUnreadMessagesByStatus() {
  const { user } = useAuth();

  const { data: counts, refetch } = useQuery({
    queryKey: ['unread-messages-by-status', user?.id],
    queryFn: async () => {
      if (!user?.id) return { pending: 0, blocked: 0, disputed: 0, completed: 0 };

      // Get all user transactions
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('id, status')
        .or(`user_id.eq.${user.id},buyer_id.eq.${user.id}`);

      if (txError || !transactions) {
        logger.error('Error fetching transactions:', txError);
        return { pending: 0, blocked: 0, disputed: 0, completed: 0 };
      }

      // Get messages not sent by user
      const { data: messages, error: msgError } = await supabase
        .from('transaction_messages')
        .select('id, transaction_id')
        .in('transaction_id', transactions.map(t => t.id))
        .neq('sender_id', user.id);

      if (msgError) {
        logger.error('Error fetching messages:', msgError);
        return { pending: 0, blocked: 0, disputed: 0, completed: 0 };
      }

      if (!messages || messages.length === 0) {
        return { pending: 0, blocked: 0, disputed: 0, completed: 0 };
      }

      const messageIds = messages.map(m => m.id);
      
      const { data: reads, error: readsError } = await supabase
        .from('message_reads')
        .select('message_id')
        .in('message_id', messageIds)
        .eq('user_id', user.id);

      if (readsError) {
        logger.error('Error fetching read status:', readsError);
      }

      const readMessageIds = new Set(reads?.map(r => r.message_id) || []);
      const unreadMessages = messages.filter(m => !readMessageIds.has(m.id));
      const unreadTransactionIds = new Set(unreadMessages.map(m => m.transaction_id));

      const counts = {
        pending: 0,
        blocked: 0,
        disputed: 0,
        completed: 0
      };

      transactions.forEach(tx => {
        if (unreadTransactionIds.has(tx.id)) {
          if (tx.status === 'pending') counts.pending++;
          else if (tx.status === 'paid') counts.blocked++;
          else if (tx.status === 'validated') counts.completed++;
        }
      });

      // Count disputed transactions
      const { data: disputes, error: disputeError } = await supabase
        .from('disputes')
        .select('id, transaction_id')
        .or(`reporter_id.eq.${user.id},transaction_id.in.(${transactions.map(t => t.id).join(',')})`);

      if (!disputeError && disputes) {
        const disputeTransactionIds = disputes.map(d => d.transaction_id);
        counts.disputed = disputeTransactionIds.filter(id => unreadTransactionIds.has(id)).length;
      }

      return counts;
    },
    enabled: !!user?.id,
    staleTime: 0,
    gcTime: 30000,
    refetchOnWindowFocus: true,
  });

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('dashboard-unread-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transaction_messages',
        },
        (payload) => {
          if (payload.new && (payload.new as any).sender_id !== user.id) {
            refetch();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_reads',
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refetch]);

  return { messageCounts: counts || { pending: 0, blocked: 0, disputed: 0, completed: 0 }, refetch };
}
