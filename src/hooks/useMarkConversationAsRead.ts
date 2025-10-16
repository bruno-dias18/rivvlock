import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Hook pour marquer une conversation comme lue
 * Utilise localStorage pour stocker le timestamp de dernière lecture
 */
export const useMarkConversationAsRead = () => {
  const queryClient = useQueryClient();

  const markAsRead = useCallback(async (conversationId: string) => {
    if (!conversationId) return;

    const key = `conversation_seen_${conversationId}`;
    const now = new Date().toISOString();
    
    localStorage.setItem(key, now);

    // Force refetch immédiat au lieu de juste invalider
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
