import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

/**
 * Hook de base pour compter les messages non lus d'une conversation
 * Source de vérité: conversation_reads.last_read_at
 * 
 * @param conversationId - ID de la conversation
 * @param queryKey - Clé unique pour React Query
 * @returns { unreadCount, refetch }
 */
export function useUnreadCountBase(
  conversationId: string | null | undefined,
  queryKey: readonly unknown[]
) {
  const { user } = useAuth();

  const { data: unreadCount = 0, refetch } = useQuery({
    queryKey,
    queryFn: async (): Promise<number> => {
      if (!conversationId || !user?.id) return 0;

      // Fetch last_read_at from DB (source of truth)
      const { data: read } = await supabase
        .from('conversation_reads')
        .select('last_read_at')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .maybeSingle();

      // Count unread messages (after last_read_at or from beginning if null)
      const { count, error } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .gt('created_at', read?.last_read_at ?? '1970-01-01T00:00:00Z');

      if (error) {
        logger.error('UnreadCountBase error', { conversationId, error: String(error) });
        return 0;
      }

      logger.debug('UnreadCountBase', { conversationId, lastReadAt: read?.last_read_at, count });
      return count || 0;
    },
    enabled: !!conversationId && !!user?.id,
    staleTime: 0,
    gcTime: 5 * 60_000,
    refetchOnMount: 'always',
  });

  return { unreadCount, refetch };
}
