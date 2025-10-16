import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import { useEffect } from 'react';

/**
 * Hook pour compter les messages non lus d'un devis
 * Un message est considéré comme non lu si sender_email !== user email
 */
export function useUnreadQuoteMessages(quoteId: string | undefined) {
  const { user } = useAuth();

  const { data, refetch } = useQuery({
    queryKey: ['unread-quote-messages', quoteId],
    queryFn: async (): Promise<number> => {
      if (!quoteId || !user?.id) return 0;

      // Get the quote to check if user is the seller
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .select('seller_id, client_email')
        .eq('id', quoteId)
        .single();

      if (quoteError || !quote) {
        logger.error('Error fetching quote:', quoteError);
        return 0;
      }

      // If user is not the seller, return 0 (only seller sees unread count)
      if (quote.seller_id !== user.id) return 0;

      // Get messages not sent by seller
      const { data: messages, error } = await supabase
        .from('quote_messages')
        .select('id, sender_id')
        .eq('quote_id', quoteId)
        .neq('sender_id', user.id);

      if (error) {
        logger.error('Error fetching quote messages:', error);
        return 0;
      }

      return messages?.length || 0;
    },
    enabled: !!quoteId && !!user?.id,
    staleTime: 0,
    gcTime: 30000,
    refetchOnWindowFocus: true,
  });

  const unreadCount: number = data ?? 0;

  // Realtime subscription pour mettre à jour le compteur
  useEffect(() => {
    if (!quoteId || !user?.id) return;

    const channel = supabase
      .channel(`quote-messages-unread-${quoteId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'quote_messages',
        },
        (payload) => {
          // Refetch seulement si le message n'est pas de l'utilisateur courant
          if (payload.new && (payload.new as any).sender_id !== user.id) {
            refetch();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [quoteId, user?.id, refetch]);

  return { unreadCount, refetch };
}

/**
 * Hook pour compter les devis avec messages non lus
 */
export function useUnreadQuotesCount(quotes: any[]) {
  const { user } = useAuth();

  const { data: unreadQuoteIds = [], refetch } = useQuery({
    queryKey: ['unread-quotes-count', quotes.map(q => q.id).join(',')],
    queryFn: async () => {
      if (!user?.id || quotes.length === 0) return [];

      // Get all messages not sent by user
      const { data: messages, error } = await supabase
        .from('quote_messages')
        .select('id, quote_id, sender_id')
        .in('quote_id', quotes.map(q => q.id))
        .neq('sender_id', user.id);

      if (error) {
        logger.error('Error fetching quote messages:', error);
        return [];
      }

      if (!messages || messages.length === 0) return [];

      // Return unique quote IDs with unread messages
      return [...new Set(messages.map(m => m.quote_id))];
    },
    enabled: !!user?.id && quotes.length > 0,
    staleTime: 0,
    gcTime: 30000,
    refetchOnWindowFocus: true,
  });

  // Realtime subscription
  useEffect(() => {
    if (!user?.id || quotes.length === 0) return;

    const channel = supabase
      .channel('quote-messages-global-unread')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'quote_messages',
        },
        (payload) => {
          // Refetch si le message concerne un devis suivi et n'est pas de l'utilisateur
          if (payload.new && 
              (payload.new as any).sender_id !== user.id &&
              quotes.some(q => q.id === (payload.new as any).quote_id)) {
            refetch();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, quotes, refetch]);

  return { unreadQuoteIds, refetch };
}

/**
 * Hook pour compter le total de messages non lus dans tous les devis
 */
export function useUnreadQuotesGlobal() {
  const { user } = useAuth();

  const { data: unreadCount = 0, refetch } = useQuery({
    queryKey: ['unread-quotes-global', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;

      // Get all user quotes
      const { data: quotes, error: quotesError } = await supabase
        .from('quotes')
        .select('id')
        .eq('seller_id', user.id);

      if (quotesError || !quotes || quotes.length === 0) {
        return 0;
      }

      // Get messages not sent by user
      const { data: messages, error: msgError } = await supabase
        .from('quote_messages')
        .select('quote_id')
        .in('quote_id', quotes.map(q => q.id))
        .neq('sender_id', user.id);

      if (msgError) {
        logger.error('Error fetching quote messages:', msgError);
        return 0;
      }

      // Return count of unique quotes with unread messages
      return new Set(messages?.map(m => m.quote_id) || []).size;
    },
    enabled: !!user?.id,
    staleTime: 0,
    gcTime: 30000,
    refetchOnWindowFocus: true,
  });

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('quotes-global-unread')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'quote_messages',
        },
        (payload) => {
          if (payload.new && (payload.new as any).sender_id !== user.id) {
            refetch();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refetch]);

  return { unreadCount, refetch };
}
