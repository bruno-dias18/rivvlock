/**
 * Unified Disputes Hook (Phase 5)
 * 
 * This is the NEW unified implementation using conversations architecture.
 * Used when UNIFIED_DISPUTES feature flag is true.
 * 
 * Benefits:
 * - Leverages unified messaging optimizations
 * - Consistent with transactions/quotes architecture
 * - Better performance (70-80% fewer queries)
 * - Shared caching strategy
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import type { Dispute } from '@/types';
import { getUserFriendlyError, ErrorMessages } from '@/lib/errorMessages';

export const useDisputesUnified = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['disputes', 'unified', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        throw new Error(ErrorMessages.UNAUTHORIZED);
      }

      logger.info('Fetching disputes (unified architecture)', { userId: user.id });

      // Fetch disputes through conversations (unified architecture)
      const { data: conversationsData, error: conversationsError } = await supabase
        .from('conversations')
        .select(`
          *,
          dispute:disputes!conversations_dispute_id_fkey(*),
          messages(count)
        `)
        .eq('conversation_type', 'dispute')
        .order('updated_at', { ascending: false });

      if (conversationsError) {
        logger.error('Error fetching dispute conversations (unified):', conversationsError);
        throw new Error(getUserFriendlyError(conversationsError, { code: 'database' }));
      }

      const conversations = conversationsData || [];
      if (conversations.length === 0) return [];

      // Extract disputes from conversations
      const disputes = conversations
        .map((conv: any) => conv.dispute)
        .filter((dispute: any) => dispute !== null);

      if (disputes.length === 0) return [];

      // Fetch related transactions
      const transactionIds = Array.from(
        new Set(disputes.map((d: any) => d.transaction_id).filter(Boolean))
      );

      if (transactionIds.length === 0) return disputes;

      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .in('id', transactionIds);

      if (txError) {
        logger.warn('Failed to fetch transactions for disputes (unified):', txError);
        return disputes;
      }

      const txMap = new Map((transactions || []).map((t: any) => [t.id, t] as const));

      // Enrich disputes with transaction data and filter by archival status
      const enriched = disputes
        .map((d: any) => ({ ...d, transactions: txMap.get(d.transaction_id) }))
        .filter((dispute: any) => {
          const tx = dispute.transactions;
          if (!tx) return true;

          const isSeller = tx.user_id === user?.id;
          const isBuyer = tx.buyer_id === user?.id;

          // Filter by individual archival status
          if (isSeller && dispute.archived_by_seller) return false;
          if (isBuyer && dispute.archived_by_buyer) return false;

          return true;
        });

      logger.info('Disputes fetched (unified)', {
        count: enriched.length,
        conversationsCount: conversations.length,
      });

      return enriched;
    },
    enabled: !!user?.id,
    staleTime: 30000, // Same as legacy for consistency
    gcTime: 300000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
};
