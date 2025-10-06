import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useUnreadDisputeAdminMessages = (disputeId: string) => {
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
    queryKey: ['unread-dispute-admin-messages', disputeId, user?.id],
    queryFn: async () => {
      if (!user?.id || !disputeId) return 0;

      const lastSeen = getLastSeenTimestamp();

      let query = supabase
        .from('dispute_messages')
        .select('id', { count: 'exact', head: true })
        .eq('dispute_id', disputeId)
        .or(`message_type.eq.admin_to_seller,message_type.eq.admin_to_buyer`)
        .eq('recipient_id', user.id);

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
