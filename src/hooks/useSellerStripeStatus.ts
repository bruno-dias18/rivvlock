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

      // Identify current user to handle self-checks (seller viewing their own status)
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const viewerId = authData?.user?.id ?? null;
      if (authError) logger.debug('[useSellerStripeStatus] auth getUser error:', authError);

      let hasActive = false;

      try {
        if (viewerId && viewerId === sellerId) {
          // Seller checking their own status -> direct read allowed by RLS
          const { data: selfData, error: selfError } = await supabase
            .from('stripe_accounts')
            .select('charges_enabled, payouts_enabled, onboarding_completed, account_status')
            .eq('user_id', sellerId)
            .maybeSingle();

          logger.debug('[useSellerStripeStatus] Self status read:', { selfData, selfError });

          if (!selfError && selfData) {
            hasActive = !!(
              selfData.charges_enabled &&
              selfData.payouts_enabled &&
              selfData.onboarding_completed &&
              selfData.account_status === 'active'
            );
          }
        } else {
          // Counterparty or external viewer -> use secure RPC restricted to counterparties
          const { data, error } = await supabase.rpc('get_counterparty_stripe_status', {
            stripe_user_id: sellerId,
          });
          logger.debug('[useSellerStripeStatus] RPC response:', { data, error });

          if (!error && Array.isArray(data) && data.length > 0) {
            const status = data[0];
            hasActive = !!status?.has_active_account;
            logger.debug('[useSellerStripeStatus] Parsed status from RPC:', status);
          }
        }

        // If inactive/unknown, trigger a secure server refresh to avoid stale DB state
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
      } catch (e) {
        logger.debug('[useSellerStripeStatus] Unexpected error:', e);
      }

      return { hasActiveAccount: hasActive };
    },
    enabled: !!sellerId,
    staleTime: 30000, // back to 30s
    retry: 2,
    retryDelay: 1000,
  });
};
