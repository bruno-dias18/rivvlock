import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useUnreadDisputesGlobal = () => {
  const { user } = useAuth();

  const { data: unreadCount = 0, refetch, isLoading } = useQuery({
    queryKey: ['unread-disputes-global', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;

      // Get all active disputes with their conversation_id
      const { data: disputes, error: disputesError } = await supabase
        .from('disputes')
        .select('id, conversation_id, status')
        .not('status', 'in', '(resolved,resolved_refund,resolved_release)')
        .not('conversation_id', 'is', null);
      
      if (disputesError) throw disputesError;
      if (!disputes || !disputes.length) return 0;

      const conversationIds = disputes
        .map((d) => d.conversation_id)
        .filter((id): id is string => id !== null);

      if (!conversationIds.length) return 0;

      let totalUnread = 0;

      // Count unread messages for each dispute conversation
      for (const conversationId of conversationIds) {
        const lastSeenKey = `conversation_seen_${conversationId}`;
        const lastSeen = localStorage.getItem(lastSeenKey);

        let query = supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conversationId)
          .neq('sender_id', user.id);

        if (lastSeen) {
          query = query.gt('created_at', lastSeen);
        }

        const { count } = await query;
        totalUnread += count || 0;
      }

      return totalUnread;
    },
    enabled: !!user?.id,
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    refetchOnMount: true,
  });

  const markAllAsSeen = () => {
    // No-op, marking is handled per conversation now
    refetch();
  };

  return { unreadCount, markAllAsSeen, refetch, isLoading };
};
