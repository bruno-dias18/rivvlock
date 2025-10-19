import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useUnreadDisputesGlobal = () => {
  const { user } = useAuth();

  const { data: unreadCount = 0, refetch, isLoading } = useQuery({
    queryKey: ['unread-disputes-global', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;

      // Get all active disputes (including those without conversation_id for resilience)
      const { data: disputes, error: disputesError } = await supabase
        .from('disputes')
        .select('id, conversation_id, status')
        .not('status', 'in', '(resolved,resolved_refund,resolved_release)');
      
      if (disputesError) throw disputesError;
      if (!disputes || !disputes.length) return 0;

      const conversationIds = disputes
        .map((d) => d.conversation_id)
        .filter((id): id is string => id !== null);

      if (!conversationIds.length) return 0;

      // Capturer nowIso une seule fois pour éviter les variations temporelles
      const nowIso = new Date().toISOString();

      // Fetch conversation_reads pour tous les conversationIds en 1 requête
      const { data: reads } = await supabase
        .from('conversation_reads')
        .select('conversation_id, last_read_at')
        .eq('user_id', user.id)
        .in('conversation_id', conversationIds);

      // Construire Map(conversationId → last_read_at)
      const lastReadMap = new Map(reads?.map(r => [r.conversation_id, r.last_read_at]) ?? []);

      // Fetch tous les messages en 1 requête
      const { data: allMessages } = await supabase
        .from('messages')
        .select('conversation_id, id, created_at')
        .in('conversation_id', conversationIds)
        .neq('sender_id', user.id);

      // Compter les messages non lus par conversation
      let totalUnread = 0;
      for (const conversationId of conversationIds) {
        const lastReadAt = lastReadMap.get(conversationId) ?? nowIso;
        const unreadInConv = allMessages?.filter(msg => 
          msg.conversation_id === conversationId && msg.created_at > lastReadAt
        ) ?? [];
        totalUnread += unreadInConv.length;
      }

      return totalUnread;
    },
    enabled: !!user?.id,
    staleTime: 5_000, // 5s pour réactivité immédiate
    gcTime: 5 * 60_000,
    refetchOnMount: true,
    refetchInterval: 10_000, // Refetch toutes les 10s en backup
  });

  const markAllAsSeen = () => {
    // No-op, marking is handled per conversation now
    refetch();
  };

  return { unreadCount, markAllAsSeen, refetch, isLoading };
};
