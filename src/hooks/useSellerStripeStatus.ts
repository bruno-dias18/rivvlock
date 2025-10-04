import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export const useSellerStripeStatus = (sellerId: string | null) => {
  return useQuery({
    queryKey: ['seller-stripe-status', sellerId],
    queryFn: async (): Promise<{ hasActiveAccount: boolean }> => {
      logger.log('[useSellerStripeStatus] START - Checking status for seller:', sellerId);

      if (!sellerId) {
        logger.log('[useSellerStripeStatus] No sellerId provided');
        return { hasActiveAccount: false };
      }

      // Use the secure RPC that verifies transaction counterparty relationship
      const { data, error } = await supabase.rpc('get_counterparty_stripe_status', {
        stripe_user_id: sellerId,
      });
      
      logger.log('[useSellerStripeStatus] RPC response:', { data, error });

      if (error) {
        logger.log('[useSellerStripeStatus] RPC error:', error);
        return { hasActiveAccount: false };
      }

      // RPC returns array with { has_active_account: boolean }
      const hasActive = Array.isArray(data) && data.length > 0 && data[0]?.has_active_account === true;
      
      logger.log('[useSellerStripeStatus] Final result - hasActiveAccount:', hasActive);

      return { hasActiveAccount: hasActive };
    },
    enabled: !!sellerId,
    staleTime: 30000, // 30s cache
    retry: 2,
    retryDelay: 1000,
  });
};
