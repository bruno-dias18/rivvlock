import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useUnreadAdminMessages = () => {
  const { user } = useAuth();

  const { data: unreadCount = 0, refetch } = useQuery({
    queryKey: ['unread-admin-messages', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;

      // ✅ NOUVEAU: Récupérer tous les dispute_ids avec leurs last_seen_at depuis la DB
      const { data: readStatuses } = await supabase
        .from('dispute_message_reads')
        .select('dispute_id, last_seen_at')
        .eq('user_id', user.id);

      // ✅ NOUVEAU: Récupérer les disputes de l'utilisateur via une jointure
      const { data: userDisputes } = await supabase
        .from('disputes')
        .select(`
          id, 
          status,
          transaction_id,
          transactions!inner(user_id, buyer_id)
        `)
        .or(`reporter_id.eq.${user.id},transactions.user_id.eq.${user.id},transactions.buyer_id.eq.${user.id}`);

      if (!userDisputes || userDisputes.length === 0) return 0;

      // Filtrer les disputes résolus
      const activeDisputeIds = userDisputes
        .filter(d => !['resolved_refund', 'resolved_release', 'resolved'].includes(d.status))
        .map(d => d.id);

      if (activeDisputeIds.length === 0) return 0;

      // Construire un map des last_seen par dispute_id
      const lastSeenMap = new Map(
        readStatuses?.map(rs => [rs.dispute_id, rs.last_seen_at]) || []
      );

      let totalUnread = 0;

      // Compter les messages non lus pour chaque dispute actif
      for (const disputeId of activeDisputeIds) {
        const lastSeen = lastSeenMap.get(disputeId);

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
        totalUnread += count || 0;
      }

      return totalUnread;
    },
    enabled: !!user?.id,
    refetchInterval: 60000, // Réduit à 60s
  });

  return {
    unreadCount,
    refetch
  };
};
