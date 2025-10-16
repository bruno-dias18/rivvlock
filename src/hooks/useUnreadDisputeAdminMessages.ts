import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Dispute } from '@/types';

export const useUnreadDisputeAdminMessages = (disputeId: string, dispute?: Dispute) => {
  const { user } = useAuth();

  const { data: unreadCount = 0, refetch } = useQuery({
    queryKey: ['unread-dispute-admin-messages', disputeId, user?.id],
    queryFn: async () => {
      if (!user?.id || !disputeId) return 0;

      // ✅ NOUVEAU: Si le dispute est résolu, retourner 0
      if (dispute?.status && ['resolved_refund', 'resolved_release', 'resolved'].includes(dispute.status)) {
        return 0;
      }

      // ✅ NOUVEAU: Récupérer last_seen_at depuis la DB au lieu de localStorage
      const { data: readStatus } = await supabase
        .from('dispute_message_reads')
        .select('last_seen_at')
        .eq('user_id', user.id)
        .eq('dispute_id', disputeId)
        .maybeSingle();

      const lastSeen = readStatus?.last_seen_at;

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
    refetchInterval: 60000, // Réduit à 60s
  });

  // ✅ DEPRECATED: markAsSeen conservé pour compatibilité
  const markAsSeen = () => {
    if (disputeId) {
      localStorage.setItem(`last_seen_dispute_${disputeId}`, new Date().toISOString());
    }
  };

  return { unreadCount, markAsSeen, refetch };
};
