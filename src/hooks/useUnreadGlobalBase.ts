import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

/**
 * Hook de base pour compter les messages non lus sur plusieurs conversations
 * Utilisé par les hooks "Global" pour agréger les comptages
 * 
 * @param conversationIds - Liste des IDs de conversations à surveiller
 * @param queryKey - Clé unique pour React Query
 * @param options - Options de configuration (staleTime, refetchInterval, etc.)
 * @returns { unreadCount, refetch, isLoading }
 */
export function useUnreadGlobalBase(
  conversationIds: string[] | null | undefined,
  queryKey: readonly unknown[],
  options?: {
    staleTime?: number;
    refetchInterval?: number;
  }
) {
  const { user } = useAuth();

  const { data: unreadCount = 0, refetch, isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<number> => {
      if (!user?.id || !conversationIds || conversationIds.length === 0) return 0;

      // Capturer nowIso une seule fois pour cohérence temporelle
      const nowIso = new Date().toISOString();

      // Fetch tous les messages en 1 requête groupée
      const { data: allMessages, error } = await supabase
        .from('messages')
        .select('conversation_id, id, created_at')
        .in('conversation_id', conversationIds)
        .neq('sender_id', user.id);

      if (error) {
        logger.error('UnreadGlobalBase messages error', { error: String(error) });
        return 0;
      }

      if (!allMessages || allMessages.length === 0) return 0;

      // Fetch conversation_reads pour tous les conversationIds en 1 requête
      const { data: reads } = await supabase
        .from('conversation_reads')
        .select('conversation_id, last_read_at')
        .eq('user_id', user.id)
        .in('conversation_id', conversationIds);

      // Construire Map(conversationId → last_read_at)
      const lastReadMap = new Map(
        reads?.map(r => [r.conversation_id, r.last_read_at]) ?? []
      );

      // Compter les messages non lus par conversation
      let totalUnread = 0;
      for (const conversationId of conversationIds) {
        const lastReadAt = lastReadMap.get(conversationId) ?? nowIso;
        const unreadInConv = allMessages.filter(
          msg => msg.conversation_id === conversationId && msg.created_at > lastReadAt
        );
        totalUnread += unreadInConv.length;
      }

      logger.debug('UnreadGlobalBase', { 
        conversationCount: conversationIds.length, 
        totalUnread 
      });

      return totalUnread;
    },
    enabled: !!user?.id && !!conversationIds && conversationIds.length > 0,
    staleTime: options?.staleTime ?? 5_000, // 5s par défaut pour réactivité
    gcTime: 5 * 60_000,
    refetchOnMount: true,
    refetchInterval: options?.refetchInterval ?? 20_000, // 20s par défaut (realtime prioritaire)
  });

  return { unreadCount, refetch, isLoading };
}
