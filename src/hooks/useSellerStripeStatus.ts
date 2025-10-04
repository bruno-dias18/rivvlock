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

      const { data, error } = await supabase
        .from('stripe_accounts')
        .select('charges_enabled, payouts_enabled, onboarding_completed, account_status')
        .eq('user_id', sellerId)
        .maybeSingle();

      if (error) {
        logger.error('[useSellerStripeStatus] Error reading stripe_accounts:', error);
        return { hasActiveAccount: false };
      }

      if (!data) {
        logger.debug('[useSellerStripeStatus] No Stripe account found for seller');
        return { hasActiveAccount: false };
      }

      const hasActive = !!(
        data.charges_enabled &&
        data.payouts_enabled &&
        data.onboarding_completed &&
        data.account_status === 'active'
      );

      logger.debug('[useSellerStripeStatus] Result:', { hasActive, data });

      return { hasActiveAccount: hasActive };
    },
    enabled: !!sellerId,
    staleTime: 30000,
    retry: 2,
    retryDelay: 1000,
  });
};
