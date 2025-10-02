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
        console.log('[useStripeAccount] User not authenticated');
        throw new Error('User not authenticated');
      }
      
      console.log('[useStripeAccount] Fetching Stripe account status...');
      const { data, error } = await supabase.functions.invoke('check-stripe-account-status');
      
      if (error) {
        console.error('[useStripeAccount] Error fetching Stripe account:', error);
        throw error;
      }
      
      console.log('[useStripeAccount] Stripe account status:', data);
      return data;
    },
    enabled: !!user?.id,
    refetchInterval: (query) => {
      // Don't poll if there's an error
      if (query.state.error) return false;
      
      // Don't poll if account is active
      const data = query.state.data;
      if (data?.has_account && data?.account_status === 'active' && !data?.onboarding_required) {
        return false;
      }
      
      // Poll every 60 seconds for pending accounts
      return 60000;
    },
    staleTime: 30000, // Consider data stale after 30 seconds
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