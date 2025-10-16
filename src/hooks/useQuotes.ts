import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Quote } from '@/types/quotes';
import { toast } from 'sonner';

export const useQuotes = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: quotes = [], isLoading, error } = useQuery({
    queryKey: ['quotes', user?.id],
    queryFn: async (): Promise<Quote[]> => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Parse items from JSON
      return (data || []).map(q => ({
        ...q,
        items: (q.items as any) || []
      })) as Quote[];
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });

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
      console.error('Error archiving quote:', error);
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
      console.error('Error resending quote email:', error);
      toast.error('Erreur lors de l\'envoi de l\'email');
    }
  });

  return {
    quotes,
    isLoading,
    error,
    archiveQuote: archiveQuote.mutateAsync,
    resendEmail: resendEmail.mutateAsync
  };
};
