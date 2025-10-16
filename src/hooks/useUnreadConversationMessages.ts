import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

/**
 * Hook pour compter les messages non lus d'une conversation
 * Utilise conversation_reads (DB) comme source de vérité
 */
export function useUnreadConversationMessages(conversationId: string | null | undefined) {
  const { user } = useAuth();

  const { data: unreadCount = 0, refetch } = useQuery({
    queryKey: ['unread-conversation-messages', conversationId, user?.id],
    queryFn: async (): Promise<number> => {
      if (!conversationId || !user?.id) return 0;

      // Étape A: récupérer last_read_at depuis conversation_reads
      const { data: read } = await supabase
        .from('conversation_reads')
        .select('last_read_at')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .maybeSingle();

      // Étape B: compter les messages non lus (après last_read_at ou depuis l'origine)
      const lastReadAt = read?.last_read_at ?? '1970-01-01T00:00:00Z';
      
      const { count, error } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .gt('created_at', lastReadAt);

      if (error) {
        logger.error('UnreadConv count error', { conversationId, error: String(error) });
        return 0;
      }
      
      logger.debug('UnreadConv from DB', { conversationId, lastReadAt, count });
      return count || 0;
    },
    enabled: !!conversationId && !!user?.id,
    staleTime: 0, // Refetch immédiat après invalidation Realtime
    gcTime: 5 * 60_000,
  });

  return { unreadCount, refetch };
}
