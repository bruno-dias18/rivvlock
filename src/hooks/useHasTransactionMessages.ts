import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useHasTransactionMessages = (transactionId: string | undefined) => {
  const { user } = useAuth();

  const { data: hasMessages = false } = useQuery({
    queryKey: ['transaction-has-messages', transactionId],
    queryFn: async () => {
      if (!transactionId) return false;

      const { data, error } = await supabase
        .from('transaction_messages')
        .select('id')
        .eq('transaction_id', transactionId)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "no rows returned" which means no messages exist
        console.error('Error checking transaction messages:', error);
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
