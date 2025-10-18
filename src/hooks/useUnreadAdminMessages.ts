import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook pour compter tous les messages admin non lus
 * Utilise le système de conversations unifiées
 */
export const useUnreadAdminMessages = () => {
  const { user } = useAuth();

  const { data: unreadCount = 0, refetch } = useQuery({
    queryKey: ['unread-admin-messages', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;

      // Récupérer les disputes actifs de l'utilisateur
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

      // Récupérer les conversations admin pour ces disputes
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id, dispute_id')
        .in('dispute_id', activeDisputeIds)
        .in('conversation_type', ['admin_seller_dispute', 'admin_buyer_dispute']);

      if (!conversations || conversations.length === 0) return 0;

      const conversationIds = conversations.map(c => c.id);

      // Récupérer les read statuses
      const { data: reads } = await supabase
        .from('conversation_reads')
        .select('conversation_id, last_read_at')
        .eq('user_id', user.id)
        .in('conversation_id', conversationIds);

      const readMap = new Map(
        reads?.map(r => [r.conversation_id, r.last_read_at]) || []
      );

      let totalUnread = 0;

      // Compter les messages non lus pour chaque conversation
      for (const convId of conversationIds) {
        const lastReadAt = readMap.get(convId) ?? '1970-01-01T00:00:00Z';

        const { count } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', convId)
          .neq('sender_id', user.id)
          .gt('created_at', lastReadAt);

        totalUnread += count || 0;
      }

      return totalUnread;
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  return {
    unreadCount,
    refetch
  };
};
