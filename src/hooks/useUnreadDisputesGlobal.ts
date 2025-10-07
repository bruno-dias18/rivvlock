import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useUnreadDisputesGlobal = () => {
  const { user } = useAuth();

  const getLastSeen = () => localStorage.getItem('last_seen_disputes_global');
  const markAllAsSeen = () => localStorage.setItem('last_seen_disputes_global', new Date().toISOString());

  const { data: unreadCount = 0, refetch, isLoading } = useQuery({
    queryKey: ['unread-disputes-global', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;

      // Get all disputes the user can see (RLS will scope correctly)
      const { data: disputes, error: disputesError } = await supabase
        .from('disputes')
        .select('id');
      if (disputesError) throw disputesError;
      const ids = (disputes || []).map((d) => d.id);
      if (!ids.length) return 0;

      const lastSeen = getLastSeen();

      let query = supabase
        .from('dispute_messages')
        .select('id', { count: 'exact', head: true })
        .in('dispute_id', ids)
        .neq('sender_id', user.id)
        .or(`recipient_id.eq.${user.id},recipient_id.is.null`)
        .not('message_type', 'ilike', 'admin%');

      if (lastSeen) {
        query = query.gt('created_at', lastSeen);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  return { unreadCount, markAllAsSeen, refetch, isLoading };
};
