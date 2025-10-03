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
  last_check?: string;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const useStripeAccount = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['stripe-account', user?.id],
    queryFn: async (): Promise<StripeAccountStatus> => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      
      let lastError: any = null;
      
      // Retry logic with backoff
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const { data, error } = await supabase.functions.invoke('check-stripe-account-status');
          
          if (error) {
            lastError = error;
            
            // Don't retry for authentication errors (401/403)
            if (error.message?.includes('Auth session missing') || 
                error.message?.includes('not authenticated') ||
                error.message?.includes('Session expirée')) {
              throw new Error('SESSION_EXPIRED');
            }
            
            // Retry for server errors (500) with exponential backoff
            if (attempt < 3) {
              const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
              await sleep(delay);
              continue;
            }
            
            throw error;
          }
          return {
            ...data,
            last_check: new Date().toISOString()
          };
        } catch (err) {
          lastError = err;
          if (err instanceof Error && err.message === 'SESSION_EXPIRED') {
            throw err;
          }
          if (attempt === 3) {
            throw err;
          }
        }
      }
      
      throw lastError;
    },
    enabled: !!user?.id,
    retry: false, // Disable react-query's retry since we handle it ourselves
    refetchInterval: (query) => {
      // Don't poll if there's an error
      if (query.state.error) return false;
      
      // Don't poll if account is active and complete
      const data = query.state.data;
      if (data?.has_account && data?.account_status === 'active' && !data?.onboarding_required) {
        return false;
      }
      
      // Poll every 60 seconds for pending accounts only
      return 60000;
    },
    staleTime: 30000,
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