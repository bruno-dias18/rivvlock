import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import { useUnreadCountBase } from './useUnreadCountBase';

/**
 * Compte les messages non lus pour une transaction (via transactionId)
 * Résout conversation_id côté DB puis utilise useUnreadCountBase
 */
export function useUnreadTransactionConversationMessages(transactionId: string | null | undefined) {
  const { user } = useAuth();

  // Step 1: Resolve conversation_id from transaction
  const { data: conversationId } = useQuery({
    queryKey: ['transaction-conversation-id', transactionId],
    queryFn: async (): Promise<string | null> => {
      if (!transactionId) return null;

      const { data: tx, error: txErr } = await supabase
        .from('transactions')
        .select('conversation_id')
        .eq('id', transactionId)
        .maybeSingle();

      if (txErr) {
        logger.error('UnreadByTx txErr', { transactionId, error: String(txErr) });
        return null;
      }

      if (!tx?.conversation_id) {
        logger.debug('UnreadByTx no conversation', { transactionId });
        return null;
      }

      return tx.conversation_id;
    },
    enabled: !!transactionId && !!user?.id,
    staleTime: 5 * 60_000,
  });

  // Step 2: Count unread messages using base hook
  const result = useUnreadCountBase(
    conversationId,
    ['unread-by-transaction', transactionId, user?.id]
  );

  return result;
}
