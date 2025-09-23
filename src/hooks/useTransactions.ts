import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAutoSync } from './useAutoSync';

export const useTransactions = () => {
  const { user } = useAuth();
  
  // Initialize auto-sync functionality
  useAutoSync();
  
  return useQuery({
    queryKey: ['transactions', user?.id],
    queryFn: async () => {
      console.log('📊 Fetching transactions for user:', user?.email);
      
      if (!user?.id) {
        console.error('❌ User not authenticated in useTransactions');
        throw new Error('User not authenticated');
      }
      
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .or(`user_id.eq.${user.id},buyer_id.eq.${user.id}`)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ Error fetching transactions:', error);
        throw error;
      }
      
      console.log('✅ Transactions fetched:', data?.length || 0, 'transactions');
      console.log('📋 Transaction details:', data?.map(t => ({ id: t.id, status: t.status, title: t.title })));
      
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 0, // Always fetch fresh data
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};

export const useTransactionCounts = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['transaction-counts', user?.id],
    queryFn: async () => {
      console.log('🔢 Fetching transaction counts for user:', user?.email);
      
      if (!user?.id) {
        console.error('❌ User not authenticated in useTransactionCounts');
        throw new Error('User not authenticated');
      }
      
      const { data, error } = await supabase
        .from('transactions')
        .select('status')
        .or(`user_id.eq.${user.id},buyer_id.eq.${user.id}`);
      
      if (error) {
        console.error('❌ Error fetching transaction counts:', error);
        throw error;
      }
      
      const counts = {
        pending: 0,
        paid: 0,
        validated: 0,
      };
      
      data?.forEach((transaction) => {
        if (transaction.status in counts) {
          counts[transaction.status as keyof typeof counts]++;
        }
      });
      
      console.log('✅ Transaction counts calculated:', counts);
      console.log('📊 Raw transaction statuses:', data?.map(t => t.status));
      
      return counts;
    },
    enabled: !!user?.id,
    staleTime: 0, // Always fetch fresh data
    refetchInterval: 15000, // Auto-refresh every 15 seconds (more aggressive)
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
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