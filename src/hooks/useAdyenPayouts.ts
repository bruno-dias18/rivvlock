import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdyenPayout, AdyenAccountingSummary } from '@/types';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

export const useAdyenPayouts = (sellerId?: string) => {
  const queryClient = useQueryClient();

  const { data: payouts, isLoading } = useQuery({
    queryKey: ['adyen-payouts', sellerId],
    queryFn: async () => {
      let query = supabase
        .from('adyen_payouts')
        .select('*')
        .order('created_at', { ascending: false });

      if (sellerId) {
        query = query.eq('seller_id', sellerId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AdyenPayout[];
    },
  });

  const { data: summary } = useQuery({
    queryKey: ['adyen-accounting-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_adyen_accounting_summary');

      if (error) throw error;
      return data[0] as AdyenAccountingSummary;
    },
    enabled: !sellerId, // Only for admin view
  });

  const updatePayoutStatus = useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      notes 
    }: { 
      id: string; 
      status: 'sent' | 'completed' | 'failed'; 
      notes?: string;
    }) => {
      const updates: any = { 
        status,
        admin_notes: notes,
      };

      if (status === 'sent') {
        updates.sent_at = new Date().toISOString();
      } else if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('adyen_payouts')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adyen-payouts'] });
      queryClient.invalidateQueries({ queryKey: ['adyen-accounting-summary'] });
      toast.success('Statut du paiement mis à jour');
    },
    onError: (error) => {
      logger.error('Failed to update payout status', error);
      toast.error('Erreur lors de la mise à jour');
    },
  });

  return {
    payouts,
    summary,
    isLoading,
    updatePayoutStatus,
  };
};
