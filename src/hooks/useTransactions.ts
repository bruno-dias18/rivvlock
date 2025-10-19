import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAutoSync } from './useAutoSync';
import { logActivity } from '@/lib/activityLogger';
import { logger } from '@/lib/logger';
import { getUserFriendlyError, ErrorMessages } from '@/lib/errorMessages';

export const useTransactions = () => {
  const { user } = useAuth();
  
  // Initialize auto-sync functionality
  useAutoSync();
  
  const queryResult = useQuery({
    queryKey: ['transactions', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        logger.error('User not authenticated in useTransactions');
        throw new Error(ErrorMessages.UNAUTHORIZED);
      }
      
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .or(`user_id.eq.${user.id},buyer_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(200); // Limit to 200 most recent transactions for performance
      
      if (error) {
        logger.error('Error fetching transactions:', error);
        throw new Error(getUserFriendlyError(error, { code: 'database' }));
      }
      
      // Enrichir avec refund_percentage depuis les propositions acceptées si disponible
      if (data && data.length > 0) {
        const transactionIds = data.map(t => t.id);
        
        // Récupérer les disputes avec propositions acceptées
        const { data: disputesData } = await supabase
          .from('disputes')
          .select('transaction_id, dispute_proposals!inner(refund_percentage, proposal_type, status, updated_at)')
          .in('transaction_id', transactionIds)
          .eq('dispute_proposals.status', 'accepted');
          
        // Créer un map des remboursements par transaction (choisir la bonne proposition acceptée)
        const refundMap = new Map<string, number>();
        if (disputesData) {
          disputesData.forEach((dispute: any) => {
            const proposals = (dispute.dispute_proposals || []) as any[];
            if (!proposals.length) return;

            // Trier par updated_at desc si disponible pour privilégier la dernière acceptée
            proposals.sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime());

            // 1) Priorité au full_refund
            const full = proposals.find(p => p.proposal_type === 'full_refund');
            if (full) {
              refundMap.set(dispute.transaction_id, 100);
              return;
            }

            // 2) Sinon prendre la dernière partial_refund avec pourcentage défini
            const partial = proposals.find(p => p.proposal_type === 'partial_refund' && p.refund_percentage != null);
            if (partial) {
              refundMap.set(dispute.transaction_id, Number(partial.refund_percentage));
              return;
            }
            
            // 3) Sinon ne rien définir (no_refund ou données incomplètes)
          });
        }
        
        // Enrichir les transactions avec les pourcentages de remboursement
        const enrichedData = data.map(transaction => ({
          ...transaction,
          refund_percentage: refundMap.get(transaction.id) || null
        }));
        
        return enrichedData;
      }
      
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 30000, // Cache for 30 seconds
    gcTime: 300000, // Keep in cache for 5 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return queryResult;
};

export const useTransactionCounts = () => {
  const { user } = useAuth();
  
  const queryResult = useQuery({
    queryKey: ['transaction-counts', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        logger.error('User not authenticated in useTransactionCounts');
        throw new Error(ErrorMessages.UNAUTHORIZED);
      }
      
      const { data, error } = await supabase
        .from('transactions')
        .select('status')
        .or(`user_id.eq.${user.id},buyer_id.eq.${user.id}`)
        .limit(500); // Limit for performance while keeping counts accurate
      
      if (error) {
        logger.error('Error fetching transaction counts:', error);
        throw new Error(getUserFriendlyError(error, { code: 'database' }));
      }
      
      const result = {
        pending: 0,
        paid: 0,
        validated: 0,
      };
      
      data?.forEach((transaction) => {
        if (transaction.status in result) {
          result[transaction.status as keyof typeof result]++;
        }
      });
      
      return result;
    },
    enabled: !!user?.id,
    staleTime: 30000, // Cache for 30 seconds - aligned with useTransactions
    // Remove auto-polling - Realtime subscriptions handle updates
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return queryResult;
};

export const useSyncStripePayments = () => {
  const { user } = useAuth();
  
  const syncPayments = async () => {
    if (!user) {
      throw new Error(ErrorMessages.UNAUTHORIZED);
    }
    
    const { data, error } = await supabase.functions.invoke('sync-stripe-payments');
    if (error) {
      throw new Error(getUserFriendlyError(error));
    }
    
    return data;
  };
  
  return { syncPayments };
};