import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface StripeAccountStatus {
  has_account: boolean;
  stripe_account_id?: string;
  account_status?: 'pending' | 'active';
  details_submitted?: boolean;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  onboarding_required?: boolean;
  onboarding_url?: string;
}

export const useStripeAccount = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['stripe-account', user?.id],
    queryFn: async (): Promise<StripeAccountStatus> => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      
      const { data, error } = await supabase.functions.invoke('check-stripe-account-status');
      
      if (error) {
        throw error;
      }
      
      return data;
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Check every 30 seconds
  });
};

export const useCreateStripeAccount = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('create-stripe-account');
      
      if (error) {
        throw error;
      }
      
      return data;
    },
    onSuccess: () => {
      // Invalidate and refetch stripe account status
      queryClient.invalidateQueries({ queryKey: ['stripe-account', user?.id] });
    },
  });
};

export const useProcessTransfer = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (transactionId: string) => {
      const { data, error } = await supabase.functions.invoke('process-automatic-transfer', {
        body: { transaction_id: transactionId }
      });
      
      if (error) {
        throw error;
      }
      
      return data;
    },
    onSuccess: () => {
      // Invalidate transactions and activity logs
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['activity'] });
    },
  });
};