import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

export interface DashboardData {
  counts: {
    pending: number;
    paid: number;
    validated: number;
  };
  disputes: Array<{
    id: string;
    status: string;
    transaction_id: string;
    created_at: string;
  }>;
  quotes: Array<{
    id: string;
    status: string;
    created_at: string;
  }>;
  stripeAccount: {
    has_account: boolean;
    payouts_enabled: boolean;
    charges_enabled: boolean;
    details_submitted: boolean;
  } | null;
  transactionIds: string[];
}

export const useDashboardData = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['dashboard-data', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase.functions.invoke<DashboardData>('get-dashboard-data');
      
      if (error) {
        logger.error('Error fetching dashboard data:', error);
        throw error;
      }

      return data;
    },
    enabled: !!user?.id,
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
    retry: 2,
  });
};
