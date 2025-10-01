import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAutoSync } from './useAutoSync';
import { logActivity } from '@/lib/activityLogger';
import { logger } from '@/lib/logger';
import { useMemo } from 'react';

export const useTransactions = () => {
  const { user } = useAuth();
  
  // Initialize auto-sync functionality
  useAutoSync();
  
  const queryResult = useQuery({
    queryKey: ['transactions', user?.id],
    queryFn: async () => {
      logger.log('📊 Fetching transactions for user:', user?.email);
      
      if (!user?.id) {
        logger.error('❌ User not authenticated in useTransactions');
        throw new Error('User not authenticated');
      }
      
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .or(`user_id.eq.${user.id},buyer_id.eq.${user.id}`)
        .order('created_at', { ascending: false });
      
      if (error) {
        logger.error('❌ Error fetching transactions:', error);
        throw error;
      }
      
      logger.log('✅ Transactions fetched:', data?.length || 0, 'transactions');
      logger.debug('📋 Transaction details:', data?.map(t => ({ id: t.id, status: t.status, title: t.title, payment_deadline: t.payment_deadline })));
      
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
      logger.log('🔢 Fetching transaction counts for user:', user?.email);
      
      if (!user?.id) {
        logger.error('❌ User not authenticated in useTransactionCounts');
        throw new Error('User not authenticated');
      }
      
      const { data, error } = await supabase
        .from('transactions')
        .select('status')
        .or(`user_id.eq.${user.id},buyer_id.eq.${user.id}`);
      
      if (error) {
        logger.error('❌ Error fetching transaction counts:', error);
        throw error;
      }
      
      const counts = useMemo(() => {
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
      }, [data]);
      
      logger.log('✅ Transaction counts calculated:', counts);
      logger.debug('📊 Raw transaction statuses:', data?.map(t => t.status));
      
      return counts;
    },
    enabled: !!user?.id,
    staleTime: 10000, // Cache for 10 seconds
    refetchInterval: 30000, // Auto-refresh every 30 seconds (less aggressive)
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return queryResult;
};

export const useSyncStripePayments = () => {
  const { user } = useAuth();
  
  const syncPayments = async () => {
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const { data, error } = await supabase.functions.invoke('sync-stripe-payments');
    if (error) {
      throw error;
    }
    
    return data;
  };
  
  return { syncPayments };
};