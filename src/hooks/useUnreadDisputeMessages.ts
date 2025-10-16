import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import type { Dispute } from '@/types';

export const useUnreadDisputeMessages = (disputeId: string, dispute?: Dispute) => {
  const { user } = useAuth();

  const { data: unreadCount = 0, refetch } = useQuery({
    queryKey: ['unread-dispute-messages', disputeId, user?.id],
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
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  // Realtime subscription
  useEffect(() => {
    if (!user?.id || !disputeId) return;

    const channel = supabase
      .channel(`dispute-messages-unread-${disputeId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dispute_messages' },
        (payload) => {
          const row = payload.new as any;
          if (row?.dispute_id === disputeId && row?.sender_id !== user.id) {
            refetch();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dispute_message_reads' },
        (payload) => {
          const row = payload.new as any;
          if (row?.dispute_id === disputeId) {
            refetch();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, disputeId, refetch]);

  // ✅ DEPRECATED: markAsSeen conservé pour compatibilité mais recommandé d'utiliser useDisputeMessageReads
  const markAsSeen = () => {
    // Fallback localStorage pour compatibilité (sera supprimé après migration)
    if (disputeId) {
      localStorage.setItem(`last_seen_dispute_${disputeId}`, new Date().toISOString());
    }
  };

  return { unreadCount, markAsSeen, refetch };
};
