import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook pour marquer une conversation comme lue
 * Utilise localStorage pour stocker le timestamp de dernière lecture
 */
export const useMarkConversationAsRead = () => {
  const queryClient = useQueryClient();

  const markAsRead = useCallback(async (conversationId: string) => {
    if (!conversationId) return;

    const key = `conversation_seen_${conversationId}`;
    // Utiliser le timestamp du dernier message côté serveur pour éviter les décalages d'horloge
    const { data: latest } = await supabase
      .from('messages')
      .select('created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastSeenValue = latest?.created_at ?? null;
    if (lastSeenValue) {
      localStorage.setItem(key, lastSeenValue);
    } else {
      // Ne rien stocker si aucune conversation n'a encore de messages
      localStorage.removeItem(key);
    }

    // ✅ Mise à jour optimiste immédiate du badge à 0
    queryClient.setQueryData(['unread-conversation-messages', conversationId], 0);

    // Force refetch pour confirmation serveur
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['unread-conversation-messages', conversationId] }),
      queryClient.refetchQueries({ queryKey: ['unread-quotes-global'] }),
      queryClient.refetchQueries({ queryKey: ['unread-quote-tabs'] }),
      queryClient.refetchQueries({ queryKey: ['unread-transactions-global'] }),
      queryClient.refetchQueries({ queryKey: ['unread-transaction-tabs'] }),
    ]);
  }, [queryClient]);

  const getLastSeen = useCallback((conversationId: string): string | null => {
    if (!conversationId) return null;
    const key = `conversation_seen_${conversationId}`;
    return localStorage.getItem(key);
  }, []);

  return { markAsRead, getLastSeen };
};
