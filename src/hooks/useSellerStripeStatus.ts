import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export const useSellerStripeStatus = (sellerId: string | null) => {
  return useQuery({
    queryKey: ['seller-stripe-status', sellerId],
    queryFn: async (): Promise<{ hasActiveAccount: boolean }> => {
      logger.debug('[useSellerStripeStatus] Fetching status for seller:', sellerId);

      if (!sellerId) {
        logger.debug('[useSellerStripeStatus] No sellerId provided');
        return { hasActiveAccount: false };
      }

      // 1) Fast path: secure RPC limited to counterparties
      const { data, error } = await supabase.rpc('get_counterparty_stripe_status', {
        stripe_user_id: sellerId,
      });
      logger.debug('[useSellerStripeStatus] RPC response:', { data, error });

      let hasActive = false;
      if (!error && Array.isArray(data) && data.length > 0) {
        const status = data[0];
        hasActive = !!status?.has_active_account;
        logger.debug('[useSellerStripeStatus] Parsed status from RPC:', status);
      }

      // 2) If inactive/unknown, trigger a secure server refresh to avoid stale DB state
      if (!hasActive) {
        logger.debug('[useSellerStripeStatus] Triggering server refresh for seller:', sellerId);
        const { data: refreshed, error: refreshError } = await supabase.functions.invoke(
          'refresh-counterparty-stripe-status',
          { body: { seller_id: sellerId } }
        );
        logger.debug('[useSellerStripeStatus] Refresh function response:', {
          refreshed,
          refreshError,
        });

        if (!refreshError && refreshed) {
          hasActive = !!refreshed.hasActiveAccount;
        }
      }

      return { hasActiveAccount: hasActive };
    },
    enabled: !!sellerId,
    staleTime: 30000, // back to 30s
    retry: 2,
    retryDelay: 1000,
  });
};
