import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import type { Dispute } from '@/types';

/**
 * Fetches and manages disputes for the current user
 * 
 * Returns disputes where the user is the reporter, seller, or buyer of the related transaction.
 * Automatically enriches disputes with transaction data and latest proposal information.
 * 
 * @returns {UseQueryResult<Dispute[]>} Query result with disputes array
 * 
 * @example
 * ```tsx
 * const { data: disputes, isLoading, refetch } = useDisputes();
 * 
 * if (isLoading) return <SkeletonLayouts.DisputeCard />;
 * if (!disputes?.length) return <EmptyStates.NoDisputes />;
 * 
 * return disputes.map(dispute => (
 *   <DisputeCard key={dispute.id} dispute={dispute} />
 * ));
 * ```
 */
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
      
      // Filtrer les litiges selon l'archivage individuel
      const enriched = disputes
        .map((d: any) => ({ ...d, transactions: txMap.get(d.transaction_id) }))
        .filter((dispute: any) => {
          const tx = dispute.transactions;
          if (!tx) return true; // Garder si transaction non trouvée (failsafe)
          
          const isSeller = tx.user_id === user?.id;
          const isBuyer = tx.buyer_id === user?.id;
          
          // Filtrer selon l'archivage individuel
          if (isSeller && dispute.archived_by_seller) return false;
          if (isBuyer && dispute.archived_by_buyer) return false;
          
          return true;
        });
      
      return enriched;

    },
    enabled: !!user?.id,
    staleTime: 30000, // Cache for 30 seconds
    gcTime: 300000, // Keep in cache for 5 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
};