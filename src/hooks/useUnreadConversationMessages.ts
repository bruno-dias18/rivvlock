import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook pour compter les messages non lus d'une conversation
 */
export function useUnreadConversationMessages(conversationId: string | null | undefined) {
  const { user } = useAuth();

  const { data: unreadCount = 0, refetch } = useQuery({
    queryKey: ['unread-conversation-messages', conversationId],
    queryFn: async (): Promise<number> => {
      if (!conversationId || !user?.id) return 0;

      // Récupérer le timestamp de dernière lecture depuis localStorage
      const lastSeenKey = `conversation_seen_${conversationId}`;
      const lastSeen = localStorage.getItem(lastSeenKey);

      // Construire la requête
      let query = supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id);

      // Si on a un lastSeen, ne compter que les messages après cette date
      if (lastSeen) {
        query = query.gt('created_at', lastSeen);
      }

      const { count, error } = await query;

      if (error) return 0;
      return count || 0;
    },
    enabled: !!conversationId && !!user?.id,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  return { unreadCount, refetch };
}
