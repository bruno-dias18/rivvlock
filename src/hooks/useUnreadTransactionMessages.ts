import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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

      const { count, error } = await supabase
        .from('transaction_messages')
        .select('*', { count: 'exact', head: true })
        .eq('transaction_id', transactionId)
        .neq('sender_id', user.id);

      if (error) {
        console.error('Error fetching unread messages count:', error);
        return 0;
      }

      return count || 0;
    },
    enabled: !!transactionId && !!user?.id,
    staleTime: 30000, // 30 secondes
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
          filter: `transaction_id=eq.${transactionId}`,
        },
        (payload) => {
          // Refetch seulement si le message n'est pas de l'utilisateur courant
          if (payload.new && (payload.new as any).sender_id !== user.id) {
            refetch();
          }
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

      // Récupérer tous les IDs de transactions qui ont des messages non lus
      const { data, error } = await supabase
        .from('transaction_messages')
        .select('transaction_id')
        .in('transaction_id', transactions.map(t => t.id))
        .neq('sender_id', user.id);

      if (error) {
        console.error('Error fetching unread transactions:', error);
        return [];
      }

      // Retourner les IDs uniques
      return [...new Set(data?.map(m => m.transaction_id) || [])];
    },
    enabled: !!user?.id && transactions.length > 0,
    staleTime: 30000,
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, transactions, refetch]);

  return { unreadTransactionIds, refetch };
}
