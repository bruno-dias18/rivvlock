import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useSellerStripeStatus = (sellerId: string | null) => {
  return useQuery({
    queryKey: ['seller-stripe-status', sellerId],
    queryFn: async (): Promise<{ hasActiveAccount: boolean }> => {
      if (!sellerId) {
        return { hasActiveAccount: false };
      }
      
      // Use the secure function that only returns non-sensitive data
      const { data, error } = await supabase
        .rpc('get_counterparty_stripe_status', { stripe_user_id: sellerId });
      
      if (error) {
        console.error('Error fetching seller stripe status:', error);
        return { hasActiveAccount: false };
      }
      
      if (!data || data.length === 0) {
        return { hasActiveAccount: false };
      }
      
      // The function returns an array with one element
      const status = data[0];
      
      return { hasActiveAccount: status.has_active_account };
    },
    enabled: !!sellerId,
  });
};