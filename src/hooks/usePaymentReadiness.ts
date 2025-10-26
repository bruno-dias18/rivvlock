import { useStripeAccount } from '@/hooks/useStripeAccount';
import { useAdyenPayoutAccount } from '@/hooks/useAdyenPayoutAccount';
import { useMemo } from 'react';

export const usePaymentReadiness = (userId?: string) => {
  const { data: stripeAccount, isLoading: stripeLoading } = useStripeAccount();
  const { defaultAccount: adyenAccount, isLoading: adyenLoading } = useAdyenPayoutAccount(userId);

  const readiness = useMemo(() => {
    const isStripeReady = 
      stripeAccount?.has_account && 
      stripeAccount?.payouts_enabled && 
      stripeAccount?.charges_enabled && 
      stripeAccount?.details_submitted;

    const isAdyenReady = 
      adyenAccount?.is_default && 
      adyenAccount?.iban;

    return {
      isStripeReady: !!isStripeReady,
      isAdyenReady: !!isAdyenReady,
      isAnyReady: !!(isStripeReady || isAdyenReady),
      isLoading: stripeLoading || adyenLoading,
      methods: {
        stripe: !!isStripeReady,
        adyen: !!isAdyenReady,
      }
    };
  }, [stripeAccount, adyenAccount, stripeLoading, adyenLoading]);

  return readiness;
};
