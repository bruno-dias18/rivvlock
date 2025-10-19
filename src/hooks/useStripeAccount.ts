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

/**
 * Manages Stripe Connect account for sellers
 * 
 * Handles Stripe account creation, onboarding, and status checking.
 * Includes retry logic with exponential backoff for reliability.
 * Sellers must complete Stripe onboarding to receive payments.
 * 
 * @returns Query result with Stripe account status and mutations for account management
 * 
 * @example
 * ```tsx
 * const { 
 *   data: stripeStatus, 
 *   isLoading,
 *   createAccount,
 *   checkStatus 
 * } = useStripeAccount();
 * 
 * if (stripeStatus?.onboarding_required) {
 *   return <Button onClick={() => window.open(stripeStatus.onboarding_url)}>
 *     Complete Stripe Setup
 *   </Button>;
 * }
 * ```
 */
export const useStripeAccount = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['stripe-account', user?.id],
    queryFn: async (): Promise<StripeAccountStatus> => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      
      console.log('[useStripeAccount] Fetching Stripe status for user:', user.id);
      
      let lastError: Error | null = null;
      
      // Retry logic with backoff
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log('[useStripeAccount] Attempt', attempt, '- Invoking check-stripe-account-status');
          const { data, error } = await supabase.functions.invoke('check-stripe-account-status');
          
          if (error) {
            console.error('[useStripeAccount] Error:', error);
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
              console.log('[useStripeAccount] Retrying in', delay, 'ms');
              await sleep(delay);
              continue;
            }
            
            throw error;
          }
          console.log('[useStripeAccount] Success:', data);
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
      
      // Poll every 3 minutes for pending accounts (conservative optimization: Stripe onboarding takes 2-5 min minimum)
      return 180000;
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