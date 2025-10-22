import { useAuth } from '@/contexts/AuthContext';
import { useUnreadCountBase } from './useUnreadCountBase';

/**
 * Hook pour compter les messages non lus d'une conversation
 * Utilise useUnreadCountBase comme fondation
 */
export function useUnreadConversationMessages(conversationId: string | null | undefined) {
  const { user } = useAuth();

  return useUnreadCountBase(
    conversationId,
    ['unread-conversation-messages', conversationId, user?.id]
  );
}
