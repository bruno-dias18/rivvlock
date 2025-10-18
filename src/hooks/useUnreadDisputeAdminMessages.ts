import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Dispute } from '@/types';

/**
 * Hook pour compter les messages admin non lus dans une conversation de litige escaladé
 * Utilise le système de conversations unifiées
 */
export const useUnreadDisputeAdminMessages = (disputeId: string, dispute?: Dispute) => {
  const { user } = useAuth();

  const { data: unreadCount = 0, refetch } = useQuery({
    queryKey: ['unread-dispute-admin-messages', disputeId, user?.id],
    queryFn: async () => {
      if (!user?.id || !disputeId) return 0;

      // Si le dispute est résolu, retourner 0
      if (dispute?.status && ['resolved_refund', 'resolved_release', 'resolved'].includes(dispute.status)) {
        return 0;
      }

      // Récupérer la conversation admin correspondante
      const { data: transaction } = await supabase
        .from('transactions')
        .select('user_id, buyer_id')
        .eq('id', dispute?.transaction_id || '')
        .maybeSingle();

      if (!transaction) return 0;

      const isSeller = transaction.user_id === user.id;
      const conversationType = isSeller ? 'admin_seller_dispute' : 'admin_buyer_dispute';

      // Trouver la conversation
      const { data: conversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('dispute_id', disputeId)
        .eq('conversation_type', conversationType)
        .maybeSingle();

      if (!conversation) return 0;

      // Récupérer last_read_at depuis conversation_reads
      const { data: read } = await supabase
        .from('conversation_reads')
        .select('last_read_at')
        .eq('conversation_id', conversation.id)
        .eq('user_id', user.id)
        .maybeSingle();

      // Compter les messages non lus
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conversation.id)
        .neq('sender_id', user.id)
        .gt('created_at', read?.last_read_at ?? '1970-01-01T00:00:00Z');

      return count || 0;
    },
    enabled: !!user?.id && !!disputeId,
    refetchInterval: 60000,
  });

  // DEPRECATED: conservé pour compatibilité
  const markAsSeen = () => {
    // No-op, géré automatiquement par UnifiedMessaging
  };

  return { unreadCount, markAsSeen, refetch };
};
