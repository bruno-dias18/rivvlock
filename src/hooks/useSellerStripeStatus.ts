import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { useIsAdmin } from '@/hooks/useIsAdmin';

export const useSellerStripeStatus = (sellerId: string | null) => {
  const { isAdmin } = useIsAdmin();
  
  return useQuery({
    queryKey: ['seller-stripe-status', sellerId, isAdmin],
    queryFn: async (): Promise<{ hasActiveAccount: boolean }> => {
      logger.debug('[useSellerStripeStatus] Fetching status for seller:', sellerId);

      if (!sellerId) {
        logger.debug('[useSellerStripeStatus] No sellerId provided');
        return { hasActiveAccount: false };
      }

      // If admin: direct DB read (already authorized by RLS)
      if (isAdmin) {
        logger.debug('[useSellerStripeStatus] Admin mode: direct DB read');
        const { data, error } = await supabase
          .from('stripe_accounts')
          .select('charges_enabled, payouts_enabled, onboarding_completed, account_status')
          .eq('user_id', sellerId)
          .neq('account_status', 'inactive')
          .maybeSingle();
        
        if (error) {
          logger.error('[useSellerStripeStatus] Error reading stripe_accounts:', error);
          return { hasActiveAccount: false };
        }
        
        if (!data) {
          logger.debug('[useSellerStripeStatus] No Stripe account found for seller');
          return { hasActiveAccount: false };
        }
        
        const hasActive = data.charges_enabled && data.payouts_enabled && data.onboarding_completed;
        logger.debug('[useSellerStripeStatus] Admin result:', { hasActive, data });
        return { hasActiveAccount: hasActive };
      }

      // If not admin: secure RPC (counterparty verification)
      logger.debug('[useSellerStripeStatus] Non-admin mode: using secure RPC');
      const { data, error } = await supabase.rpc('get_counterparty_stripe_status', {
        stripe_user_id: sellerId,
      });
      
      let hasActive = false;
      if (!error && Array.isArray(data) && data.length > 0) {
        hasActive = data[0]?.has_active_account || false;
        logger.debug('[useSellerStripeStatus] RPC result:', { hasActive, data });
      }

      // If inactive or error, refresh from Stripe to avoid stale DB state
      if (!hasActive) {
        logger.debug('[useSellerStripeStatus] Triggering refresh for seller:', sellerId);
        const { data: refreshed, error: refreshError } = await supabase.functions.invoke(
          'refresh-counterparty-stripe-status',
          { body: { seller_id: sellerId } }
        );
        
        if (!refreshError && refreshed) {
          hasActive = refreshed.hasActiveAccount || false;
          logger.debug('[useSellerStripeStatus] Refreshed result:', { hasActive, refreshed });
        }
      }

      return { hasActiveAccount: hasActive };
    },
    enabled: !!sellerId,
    staleTime: 30000,
    retry: 2,
    retryDelay: 1000,
  });
};
