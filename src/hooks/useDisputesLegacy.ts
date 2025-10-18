/**
 * Legacy Disputes Hook
 * 
 * This is the ORIGINAL disputes implementation (pre-Phase 5).
 * Used when UNIFIED_DISPUTES feature flag is false.
 * 
 * DO NOT MODIFY - This is preserved for rollback capability.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import type { Dispute } from '@/types';
import { getUserFriendlyError, ErrorMessages } from '@/lib/errorMessages';

export const useDisputesLegacy = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['disputes', 'legacy', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        throw new Error(ErrorMessages.UNAUTHORIZED);
      }

      // Step 1: fetch disputes only (RLS restricts to reporter/seller/buyer)
      const { data: disputesData, error: disputesError } = await supabase
        .from('disputes')
        .select('*')
        .order('created_at', { ascending: false });

      if (disputesError) {
        logger.error('Error fetching disputes (legacy):', disputesError);
        throw new Error(getUserFriendlyError(disputesError, { code: 'database' }));
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
        logger.warn('Failed to fetch transactions for disputes (legacy):', txError);
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
