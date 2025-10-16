import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Hook pour marquer une conversation comme lue
 * Utilise localStorage pour stocker le timestamp de dernière lecture
 */
export const useMarkConversationAsRead = () => {
  const queryClient = useQueryClient();

  const markAsRead = useCallback((conversationId: string) => {
    if (!conversationId) return;

    const key = `conversation_seen_${conversationId}`;
    const now = new Date().toISOString();
    
    localStorage.setItem(key, now);

    // Invalider les queries de comptage pour mettre à jour les badges
    queryClient.invalidateQueries({ queryKey: ['unread-conversation-messages', conversationId] });
    queryClient.invalidateQueries({ queryKey: ['unread-quotes-global'] });
  }, [queryClient]);

  const getLastSeen = useCallback((conversationId: string): string | null => {
    if (!conversationId) return null;
    const key = `conversation_seen_${conversationId}`;
    return localStorage.getItem(key);
  }, []);

  return { markAsRead, getLastSeen };
};
