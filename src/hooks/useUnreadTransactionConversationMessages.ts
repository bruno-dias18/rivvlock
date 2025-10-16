import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

/**
 * Compte les messages non lus pour une transaction (via transactionId)
 * Résout conversation_id côté DB pour éviter les incohérences côté client
 */
export function useUnreadTransactionConversationMessages(transactionId: string | null | undefined) {
  const { user } = useAuth();

  const { data: unreadCount = 0, refetch } = useQuery({
    queryKey: ['unread-by-transaction', transactionId, user?.id],
    queryFn: async (): Promise<number> => {
      if (!transactionId || !user?.id) return 0;

      // 1) Récupérer conversation_id depuis la transaction
      const { data: tx, error: txErr } = await supabase
        .from('transactions')
        .select('conversation_id')
        .eq('id', transactionId)
        .maybeSingle();

      if (txErr) {
        logger.error('UnreadByTx txErr', { transactionId, error: String(txErr) });
        return 0;
      }

      const conversationId = tx?.conversation_id;
      if (!conversationId) {
        logger.debug('UnreadByTx no conversation', { transactionId });
        return 0;
      }

      // 2) Lire last_read_at depuis conversation_reads (source de vérité)
      const { data: read } = await supabase
        .from('conversation_reads')
        .select('last_read_at')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .maybeSingle();

      const since = read?.last_read_at ?? '1970-01-01T00:00:00Z';

      // 3) Compter les messages non lus (après last_read_at, et pas les siens)
      const { count, error } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .gt('created_at', since);

      if (error) {
        logger.error('UnreadByTx count error', { transactionId, conversationId, error: String(error) });
        return 0;
      }

      logger.debug('UnreadByTx', { transactionId, conversationId, lastReadAt: read?.last_read_at, count });
      return count || 0;
    },
    enabled: !!transactionId && !!user?.id,
    staleTime: 0,
    gcTime: 5 * 60_000,
    refetchOnMount: 'always',
  });

  return { unreadCount, refetch };
}
