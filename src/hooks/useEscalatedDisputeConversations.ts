import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

interface EscalatedDisputeConversationsOptions {
  disputeId: string;
  transactionId: string;
}

/**
 * Hook pour récupérer la conversation privée avec l'admin
 * Détermine automatiquement si l'utilisateur est seller ou buyer
 * et retourne la conversation correspondante
 */
export function useEscalatedDisputeConversations({ 
  disputeId, 
  transactionId 
}: EscalatedDisputeConversationsOptions) {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['escalated-dispute-conversation', disputeId, user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');

      // 1. Déterminer le rôle de l'utilisateur (seller ou buyer)
      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .select('user_id, buyer_id')
        .eq('id', transactionId)
        .maybeSingle();

      if (txError) throw txError;
      if (!transaction) throw new Error('Transaction not found');

      if (txError) throw txError;

      const isSeller = transaction.user_id === user.id;
      const conversationType = isSeller ? 'admin_seller_dispute' : 'admin_buyer_dispute';

      logger.debug('Escalated dispute conversation', { 
        disputeId, 
        isSeller, 
        conversationType 
      });

      // 2. Récupérer la conversation correspondante
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .eq('dispute_id', disputeId)
        .eq('conversation_type', conversationType)
        .maybeSingle();

      if (convError) throw convError;

      return {
        conversationId: conversation?.id,
        isSeller,
        isReady: !!conversation?.id,
      };
    },
    enabled: !!user?.id && !!disputeId && !!transactionId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  return {
    conversationId: data?.conversationId,
    isSeller: data?.isSeller,
    isReady: data?.isReady,
    isLoading,
  };
}
