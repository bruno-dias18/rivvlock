import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

interface AdminDisputeConversationsOptions {
  disputeId: string;
  sellerId: string;
  buyerId: string;
}

/**
 * Hook admin pour gérer les 2 conversations séparées :
 * - Admin ↔ Seller
 * - Admin ↔ Buyer
 */
export function useAdminDisputeConversations({ 
  disputeId, 
  sellerId, 
  buyerId 
}: AdminDisputeConversationsOptions) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-dispute-conversations', disputeId],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');

      // Récupérer les 2 conversations
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select('id, conversation_type, buyer_id')
        .eq('dispute_id', disputeId)
        .in('conversation_type', ['admin_seller_dispute', 'admin_buyer_dispute']);

      if (error) throw error;

      const sellerConv = conversations?.find(
        c => c.conversation_type === 'admin_seller_dispute'
      );
      const buyerConv = conversations?.find(
        c => c.conversation_type === 'admin_buyer_dispute'
      );

      logger.debug('Admin dispute conversations', {
        disputeId,
        hasSellerConv: !!sellerConv,
        hasBuyerConv: !!buyerConv,
      });

      return {
        sellerConversationId: sellerConv?.id,
        buyerConversationId: buyerConv?.id,
        isReady: !!sellerConv && !!buyerConv,
      };
    },
    enabled: !!user?.id && !!disputeId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  // Mutation pour créer les conversations si elles n'existent pas
  const createConversations = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase.rpc(
        'create_escalated_dispute_conversations',
        {
          p_dispute_id: disputeId,
          p_admin_id: user.id,
        }
      );

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['admin-dispute-conversations', disputeId] 
      });
    },
  });

  return {
    sellerConversationId: data?.sellerConversationId,
    buyerConversationId: data?.buyerConversationId,
    isReady: data?.isReady,
    isLoading,
    createConversations: createConversations.mutateAsync,
    isCreating: createConversations.isPending,
  };
}
