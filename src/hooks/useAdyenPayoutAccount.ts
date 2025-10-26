import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdyenPayoutAccount } from '@/types';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

export const useAdyenPayoutAccount = (userId?: string) => {
  const queryClient = useQueryClient();

  const { data: payoutAccounts, isLoading } = useQuery({
    queryKey: ['adyen-payout-accounts', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('adyen_payout_accounts')
        .select('*')
        .eq('user_id', userId || '')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as AdyenPayoutAccount[];
    },
    enabled: !!userId,
  });

  const addPayoutAccount = useMutation({
    mutationFn: async (account: {
      user_id: string;
      iban: string;
      bic?: string;
      account_holder_name: string;
      bank_name?: string;
      country: string;
      is_default?: boolean;
      metadata?: Record<string, any>;
    }) => {
      const { error } = await supabase
        .from('adyen_payout_accounts')
        .insert(account);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adyen-payout-accounts', userId] });
      toast.success('Compte bancaire ajouté avec succès');
    },
    onError: (error) => {
      logger.error('Failed to add payout account', error);
      toast.error('Erreur lors de l\'ajout du compte bancaire');
    },
  });

  const updatePayoutAccount = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<AdyenPayoutAccount> }) => {
      const { error } = await supabase
        .from('adyen_payout_accounts')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adyen-payout-accounts', userId] });
      toast.success('Compte bancaire mis à jour');
    },
    onError: (error) => {
      logger.error('Failed to update payout account', error);
      toast.error('Erreur lors de la mise à jour');
    },
  });

  return {
    payoutAccounts,
    defaultAccount: payoutAccounts?.find(acc => acc.is_default),
    isLoading,
    addPayoutAccount,
    updatePayoutAccount,
  };
};
