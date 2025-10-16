import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Quote } from '@/types/quotes';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

export const useQuotes = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: quotes = [], isLoading, error } = useQuery({
    queryKey: ['quotes', user?.id],
    queryFn: async (): Promise<Quote[]> => {
      if (!user?.id) throw new Error('Not authenticated');

      // Fetch quotes where user is seller OR client
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .or(`seller_id.eq.${user.id},client_user_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Parse items from JSON and ensure all fields are present
      return (data || []).map(q => ({
        ...q,
        client_user_id: q.client_user_id || null,
        items: (q.items as any) || []
      })) as Quote[];
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });

  // Separate sent and received quotes
  const sentQuotes = quotes.filter(q => q.seller_id === user?.id);
  const receivedQuotes = quotes.filter(q => q.client_user_id === user?.id);

  const archiveQuote = useMutation({
    mutationFn: async (quoteId: string) => {
      const { error } = await supabase
        .from('quotes')
        .update({ status: 'archived' })
        .eq('id', quoteId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('Devis archivé');
    },
    onError: (error) => {
      logger.error('Error archiving quote:', error);
      toast.error('Erreur lors de l\'archivage');
    }
  });

  const resendEmail = useMutation({
    mutationFn: async (quoteId: string) => {
      const { data, error } = await supabase.functions.invoke('resend-quote-email', {
        body: { quote_id: quoteId }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Email renvoyé avec succès à ${data.client_email}`);
    },
    onError: (error) => {
      logger.error('Error resending quote email:', error);
      toast.error('Erreur lors de l\'envoi de l\'email');
    }
  });

  const updateQuote = useMutation({
    mutationFn: async (params: {
      quoteId: string;
      data: {
        title: string;
        description: string | null;
        items: any[];
        currency: string;
        service_date: string | null;
        service_end_date: string | null;
        valid_until: string;
        total_amount: number;
        fee_ratio_client: number;
      }
    }) => {
      const { data, error } = await supabase.functions.invoke('update-quote', {
        body: {
          quote_id: params.quoteId,
          ...params.data
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('Devis modifié avec succès');
    },
    onError: (error) => {
      logger.error('Error updating quote:', error);
      toast.error('Erreur lors de la modification du devis');
    }
  });

  const acceptQuote = useMutation({
    mutationFn: async ({ quoteId, token }: { quoteId: string; token?: string }) => {
      const { data, error } = await supabase.functions.invoke('accept-quote', {
        body: { quoteId, token }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Devis accepté avec succès !');
    },
    onError: (error: any) => {
      logger.error('Error accepting quote:', error);
      toast.error(error.message || 'Erreur lors de l\'acceptation du devis');
    }
  });

  const markAsViewed = useMutation({
    mutationFn: async (quoteId: string) => {
      const { error } = await supabase.functions.invoke('mark-quote-as-viewed', {
        body: { quoteId }
      });

      if (error) throw error;
    },
    onSuccess: () => {
      // Silently refresh quotes to update the UI
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
    onError: (error) => {
      // Fail silently, this is not critical
      logger.error('Error marking quote as viewed:', error);
    }
  });

  return {
    quotes,
    sentQuotes,
    receivedQuotes,
    isLoading,
    error,
    archiveQuote: archiveQuote.mutateAsync,
    resendEmail: resendEmail.mutateAsync,
    updateQuote: updateQuote.mutateAsync,
    acceptQuote: acceptQuote.mutateAsync,
    markAsViewed: markAsViewed.mutateAsync
  };
};
