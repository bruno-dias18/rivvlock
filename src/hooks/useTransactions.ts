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
      
      // Use edge function for server-side enrichment
      const { data, error } = await supabase.functions.invoke('get-transactions-enriched', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });
      
      if (error) {
        logger.error('Error fetching enriched transactions:', error);
        throw new Error(getUserFriendlyError(error, { code: 'database' }));
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