import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

export const useHasTransactionMessages = (transactionId: string | undefined) => {
  const { user } = useAuth();

  const { data: hasMessages = false } = useQuery<boolean>({
    queryKey: ['transaction-has-messages', transactionId],
    queryFn: async () => {
      if (!transactionId) return false;

      // Check if there are any messages linked directly to this transaction
      const { data, error } = await (supabase as any)
        .from('messages')
        .select('id')
        .eq('transaction_id', transactionId)
        .limit(1)
        .single();

      // PGRST116 is "no rows returned" which means no messages exist
      if (error && (error as any).code !== 'PGRST116') {
        logger.error('Error checking messages:', error);
        return false;
      }

      return !!data;
    },
    enabled: !!user && !!transactionId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });

  return hasMessages;
};
