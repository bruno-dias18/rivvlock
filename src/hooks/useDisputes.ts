import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import { useMemo } from 'react';

export const useDisputes = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['disputes', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Step 1: fetch disputes only (RLS restricts to reporter/seller/buyer)
      const { data: disputesData, error: disputesError } = await supabase
        .from('disputes')
        .select('*')
        .order('created_at', { ascending: false });

      if (disputesError) {
        throw disputesError;
      }

      const disputes = disputesData || [];
      if (disputes.length === 0) return [];

      // Step 2: fetch related transactions separately (no FK relation defined)
      const transactionIds = Array.from(new Set(disputes.map((d: any) => d.transaction_id).filter(Boolean)));
      if (transactionIds.length === 0) return disputes;

      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .in('id', transactionIds);

      if (txError) {
        // Do not break the page; return disputes without embedded transaction
        logger.warn('Failed to fetch transactions for disputes:', txError);
        return disputes;
      }

      const txMap = new Map((transactions || []).map((t: any) => [t.id, t] as const));
      const enriched = useMemo(
        () => disputes.map((d: any) => ({ ...d, transactions: txMap.get(d.transaction_id) })),
        [disputes, txMap]
      );
      return enriched;

    },
    enabled: !!user?.id,
    staleTime: 30000, // Cache for 30 seconds
    gcTime: 300000, // Keep in cache for 5 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
};