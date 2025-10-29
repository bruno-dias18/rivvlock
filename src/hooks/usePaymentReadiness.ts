import { useStripeAccount } from '@/hooks/useStripeAccount';
import { useMemo } from 'react';

export const usePaymentReadiness = (userId?: string) => {
  const { data: stripeAccount, isLoading: stripeLoading } = useStripeAccount();

  const readiness = useMemo(() => {
    const isStripeReady = 
      stripeAccount?.has_account && 
      stripeAccount?.payouts_enabled && 
      stripeAccount?.charges_enabled && 
      stripeAccount?.details_submitted;

    return {
      isStripeReady: !!isStripeReady,
      isAnyReady: !!isStripeReady,
      isLoading: stripeLoading,
      methods: {
        stripe: !!isStripeReady,
      }
    };
  }, [stripeAccount, stripeLoading]);

  return readiness;
};
