import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

export const useUnreadDisputesGlobal = () => {
  const { user } = useAuth();

  const { data: unreadCount = 0, refetch, isLoading } = useQuery({
    queryKey: ['unread-disputes-global', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;

      // ✅ NOUVEAU: Récupérer tous les dispute_message_reads de l'utilisateur
      const { data: readStatuses } = await supabase
        .from('dispute_message_reads')
        .select('dispute_id, last_seen_at')
        .eq('user_id', user.id);

      const lastSeenMap = new Map(
        readStatuses?.map(rs => [rs.dispute_id, rs.last_seen_at]) || []
      );

      // Get all disputes the user can see, excluding resolved ones
      const { data: disputes, error: disputesError } = await supabase
        .from('disputes')
        .select('id, status')
        .not('status', 'in', '(resolved,resolved_refund,resolved_release)');
      
      if (disputesError) throw disputesError;
      const ids = (disputes || []).map((d) => d.id);
      if (!ids.length) return 0;

      let totalUnread = 0;

      // Compter les messages non lus pour chaque dispute actif
      for (const disputeId of ids) {
        const lastSeen = lastSeenMap.get(disputeId);

        let query = supabase
          .from('dispute_messages')
          .select('id', { count: 'exact', head: true })
          .eq('dispute_id', disputeId)
          .neq('sender_id', user.id)
          .or(`recipient_id.eq.${user.id},recipient_id.is.null`);

        if (lastSeen) {
          query = query.gt('created_at', lastSeen);
        }

        const { count } = await query;
        totalUnread += count || 0;
      }

      return totalUnread;
    },
    enabled: !!user?.id,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('disputes-global-unread')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dispute_messages' },
        (payload) => {
          const row = payload.new as any;
          if (row?.sender_id !== user.id) {
            refetch();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dispute_message_reads' },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refetch]);

  // ✅ DEPRECATED: markAllAsSeen conservé pour compatibilité
  const markAllAsSeen = () => {
    localStorage.setItem('last_seen_disputes_global', new Date().toISOString());
  };

  return { unreadCount, markAllAsSeen, refetch, isLoading };
};
