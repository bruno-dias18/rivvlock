import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUnreadGlobalBase } from './useUnreadGlobalBase';

/**
 * Hook pour compter tous les messages admin non lus
 * Utilise useUnreadGlobalBase comme fondation
 */
export const useUnreadAdminMessages = () => {
  const { user } = useAuth();

  // Step 1: Récupérer les IDs de conversations admin
  const { data: conversationIds } = useQuery({
    queryKey: ['admin-conversation-ids', user?.id],
    queryFn: async (): Promise<string[]> => {
      if (!user?.id) return [];

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

      if (!userDisputes || userDisputes.length === 0) return [];

      // Filtrer les disputes résolus
      const activeDisputeIds = userDisputes
        .filter(d => !['resolved_refund', 'resolved_release', 'resolved'].includes(d.status))
        .map(d => d.id);

      if (activeDisputeIds.length === 0) return [];

      // Récupérer les conversations admin pour ces disputes
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id, dispute_id')
        .in('dispute_id', activeDisputeIds)
        .in('conversation_type', ['admin_seller_dispute', 'admin_buyer_dispute']);

      if (!conversations || conversations.length === 0) return [];

      return conversations.map(c => c.id);
    },
    enabled: !!user?.id,
    staleTime: 60_000, // Cache 1 minute
  });

  // Step 2: Compter les messages non lus avec le hook de base
  const { unreadCount, refetch } = useUnreadGlobalBase(
    conversationIds,
    ['unread-admin-messages', user?.id],
    {
      staleTime: 30_000, // 30s pour les messages admin
      refetchInterval: 60_000, // 60s
    }
  );

  return { unreadCount, refetch };
};
