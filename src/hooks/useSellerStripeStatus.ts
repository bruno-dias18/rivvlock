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

      let hasActive = false;

      try {
        // Identify current user to handle self-checks (seller viewing their own status)
        const { data: authData, error: authError } = await supabase.auth.getUser();
        const viewerId = authData?.user?.id ?? null;
        if (authError) logger.log('[useSellerStripeStatus] auth getUser error:', authError);

        if (viewerId && viewerId === sellerId) {
          // Seller checking their own status -> use secure RPC instead
          const { data: selfData, error: selfError } = await supabase.rpc('get_counterparty_stripe_status', {
            stripe_user_id: sellerId
          });

          logger.log('[useSellerStripeStatus] Self status read:', { selfData, selfError });

          if (!selfError && Array.isArray(selfData) && selfData.length > 0) {
            const status = selfData[0];
            hasActive = !!status?.has_active_account;
          }
        } else {
          // Counterparty or external viewer -> use secure RPC restricted to counterparties
          const { data, error } = await supabase.rpc('get_counterparty_stripe_status', {
            stripe_user_id: sellerId,
          });
          logger.log('[useSellerStripeStatus] RPC response:', { data, error });

          if (!error && Array.isArray(data) && data.length > 0) {
            const status = data[0];
            hasActive = !!status?.has_active_account;
            logger.log('[useSellerStripeStatus] Parsed status from RPC:', status);
          }
        }

        // Optional: if inactive/unknown, trigger a secure server refresh to avoid stale DB state
        if (!hasActive) {
          logger.log('[useSellerStripeStatus] Triggering server refresh for seller:', sellerId);
          const { data: refreshed, error: refreshError } = await supabase.functions.invoke(
            'refresh-counterparty-stripe-status',
            { body: { seller_id: sellerId } }
          );
          logger.log('[useSellerStripeStatus] Refresh function response:', { refreshed, refreshError });

          if (!refreshError && refreshed) {
            hasActive = !!refreshed.hasActiveAccount;
          }
        }
      } catch (e) {
        logger.log('[useSellerStripeStatus] Unexpected error:', e);
      }

      logger.log('[useSellerStripeStatus] Final result - hasActiveAccount:', hasActive);
      return { hasActiveAccount: hasActive };
    },
    enabled: !!sellerId,
    staleTime: 30000, // 30s cache
    retry: 2,
    retryDelay: 1000,
  });
};
