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
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .or(`user_id.eq.${user.id},buyer_id.eq.${user.id}`)
        .order('created_at', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      return data || [];
    },
    enabled: !!user?.id,
  });
};

export const useTransactionCounts = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['transaction-counts', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      
      const { data, error } = await supabase
        .from('transactions')
        .select('status')
        .or(`user_id.eq.${user.id},buyer_id.eq.${user.id}`);
      
      if (error) {
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
      
      return counts;
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
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