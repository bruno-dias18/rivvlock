import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useSellerStripeStatus = (sellerId: string | null) => {
  return useQuery({
    queryKey: ['seller-stripe-status', sellerId],
    queryFn: async (): Promise<{ hasActiveAccount: boolean }> => {
      if (!sellerId) {
        return { hasActiveAccount: false };
      }
      
      // Fetch seller's stripe account from database
      const { data, error } = await supabase
        .from('stripe_accounts')
        .select('account_status, charges_enabled, payouts_enabled, onboarding_completed')
        .eq('user_id', sellerId)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching seller stripe status:', error);
        return { hasActiveAccount: false };
      }
      
      if (!data) {
        return { hasActiveAccount: false };
      }
      
      // Account is considered active if it can receive payouts
      const hasActiveAccount = data.payouts_enabled && data.charges_enabled && data.onboarding_completed;
      
      return { hasActiveAccount };
    },
    enabled: !!sellerId,
  });
};