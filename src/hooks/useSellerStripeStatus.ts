import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useSellerStripeStatus = (sellerId: string | null) => {
  return useQuery({
    queryKey: ['seller-stripe-status', sellerId],
    queryFn: async (): Promise<{ hasActiveAccount: boolean }> => {
      console.log('[useSellerStripeStatus] Fetching status for seller:', sellerId);
      
      if (!sellerId) {
        console.log('[useSellerStripeStatus] No sellerId provided');
        return { hasActiveAccount: false };
      }
      
      // Use the secure function that only returns non-sensitive data
      const { data, error } = await supabase
        .rpc('get_counterparty_stripe_status', { stripe_user_id: sellerId });
      
      console.log('[useSellerStripeStatus] RPC response:', { data, error });
      
      if (error) {
        console.error('[useSellerStripeStatus] Error fetching seller stripe status:', error);
        return { hasActiveAccount: false };
      }
      
      if (!data || data.length === 0) {
        console.log('[useSellerStripeStatus] No data returned or empty array');
        return { hasActiveAccount: false };
      }
      
      // The function returns an array with one element
      const status = data[0];
      console.log('[useSellerStripeStatus] Parsed status:', status);
      
      return { hasActiveAccount: status.has_active_account };
    },
    enabled: !!sellerId,
    staleTime: 10000, // 10 secondes au lieu de 30
    retry: 2,
    retryDelay: 1000,
  });
};
