import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface ProblematicTransaction {
  id: string;
  title: string;
  price: number;
  currency: string;
  status: string;
  buyer_id: string | null;
  stripe_payment_intent_id: string | null;
  created_at: string;
  user_id: string;
}

export function useProblematicTransactions() {
  return useQuery({
    queryKey: ['problematic-transactions'],
    queryFn: async () => {
      logger.log('Fetching problematic transactions (paid but no buyer)');
      
      const { data, error } = await supabase
        .from('transactions')
        .select('id, title, price, currency, status, buyer_id, stripe_payment_intent_id, created_at, user_id')
        .eq('status', 'paid')
        .is('buyer_id', null);

      if (error) {
        logger.error('Error fetching problematic transactions:', error);
        throw error;
      }

      logger.log(`Found ${data?.length || 0} problematic transactions`);
      return (data || []) as ProblematicTransaction[];
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    staleTime: 10000,
  });
}
