import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useUnreadDisputeMessages = (disputeId: string) => {
  const { user } = useAuth();

  const getLastSeenTimestamp = (): string | null => {
    if (!disputeId) return null;
    return localStorage.getItem(`last_seen_dispute_${disputeId}`);
  };

  const markAsSeen = () => {
    if (!disputeId) return;
    localStorage.setItem(`last_seen_dispute_${disputeId}`, new Date().toISOString());
  };

  const { data: unreadCount = 0, refetch } = useQuery({
    queryKey: ['unread-dispute-messages', disputeId, user?.id],
    queryFn: async () => {
      if (!user?.id || !disputeId) return 0;

      const lastSeen = getLastSeenTimestamp();

      // Tous les messages où je suis destinataire OU broadcast (recipient_id null)
      let query = supabase
        .from('dispute_messages')
        .select('id', { count: 'exact', head: true })
        .eq('dispute_id', disputeId)
        .neq('sender_id', user.id) // Exclure mes propres messages
        .or(`recipient_id.eq.${user.id},recipient_id.is.null`);

      if (lastSeen) {
        query = query.gt('created_at', lastSeen);
      }

      const { count } = await query;
      return count || 0;
    },
    enabled: !!user?.id && !!disputeId,
    refetchInterval: 30000,
  });

  return { unreadCount, markAsSeen, refetch };
};
