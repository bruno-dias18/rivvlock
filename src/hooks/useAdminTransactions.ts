import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface AdminTransaction {
  id: string;
  title: string;
  price: number;
  currency: string;
  status: string;
  seller_display_name: string | null;
  buyer_display_name: string | null;
  created_at: string;
}

export const useAdminTransactions = (limit = 10) => {
  return useQuery({
    queryKey: ['admin-transactions', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, title, price, currency, status, seller_display_name, buyer_display_name, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Error fetching admin transactions:', error);
        throw error;
      }

      return data as AdminTransaction[];
    },
    refetchInterval: 60000, // Réduit à 60s
  });
};