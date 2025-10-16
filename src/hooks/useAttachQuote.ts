import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface AttachQuoteParams {
  quoteId: string;
  token: string;
}

export const useAttachQuote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ quoteId, token }: AttachQuoteParams) => {
      const { data, error } = await supabase.functions.invoke('attach-quote-to-user', {
        body: { quoteId, token }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quote-messages'] });
      
      if (data?.message !== 'Devis déjà rattaché à votre compte' && 
          data?.message !== 'Vous êtes le vendeur de ce devis') {
        toast.success('✅ Ce devis est maintenant dans votre espace');
      }
    },
    onError: (error: any) => {
      logger.error('Error attaching quote:', error);
      
      // Special case: email mismatch (UI will handle this with AlertDialog)
      if (error.message?.includes('email_mismatch') || error.error === 'email_mismatch') {
        // Don't show toast, let the parent component handle the alert
        return;
      }
      
      // Don't show error toast if already attached
      if (!error.message?.includes('déjà rattaché')) {
        toast.error(error.message || 'Erreur lors du rattachement');
      }
    }
  });
};
