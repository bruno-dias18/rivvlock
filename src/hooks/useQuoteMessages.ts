import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { QuoteMessage } from '@/types/quotes';
import { toast } from 'sonner';
import { useEffect } from 'react';
import { useAttachQuote } from './useAttachQuote';

export const useQuoteMessages = (quoteId: string, token?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { mutateAsync: attachQuote } = useAttachQuote();

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['quote-messages', quoteId],
    queryFn: async (): Promise<QuoteMessage[]> => {
      const { data, error } = await supabase
        .from('quote_messages')
        .select('*')
        .eq('quote_id', quoteId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as QuoteMessage[];
    },
    enabled: !!quoteId,
    staleTime: 5000,
  });

  // Real-time subscription
  useEffect(() => {
    if (!quoteId) return;

    const channel = supabase
      .channel(`quote-messages-${quoteId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'quote_messages',
          filter: `quote_id=eq.${quoteId}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['quote-messages', quoteId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [quoteId, queryClient]);

  const sendMessage = useMutation({
    mutationFn: async ({
      message,
      senderEmail,
      senderName
    }: {
      message: string;
      senderEmail: string;
      senderName: string;
    }) => {
      // Attach quote if user is connected
      if (user && token) {
        try {
          await attachQuote({ quoteId, token });
        } catch (err) {
          console.log('Quote attachment error (non-critical):', err);
          // Continue even if attachment fails (might be already attached)
        }
      }

      const { error } = await supabase
        .from('quote_messages')
        .insert({
          quote_id: quoteId,
          sender_id: user?.id || null,
          sender_email: senderEmail,
          sender_name: senderName,
          message,
          message_type: 'text'
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-messages', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('Message envoyé');
    },
    onError: (error) => {
      console.error('Error sending message:', error);
      toast.error('Erreur lors de l\'envoi');
    }
  });

  return {
    messages,
    isLoading,
    sendMessage: sendMessage.mutateAsync,
    isSendingMessage: sendMessage.isPending
  };
};
