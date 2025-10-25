import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUnreadGlobalBase } from './useUnreadGlobalBase';

/**
 * Hook pour compter le nombre total de messages non lus dans toutes les transactions de l'utilisateur
 * Utilise useUnreadGlobalBase comme fondation
 */
export const useUnreadTransactionsGlobal = () => {
  const { user } = useAuth();

  // Step 1: Récupérer les IDs de conversations
  const { data: conversationIds } = useQuery({
    queryKey: ['transaction-conversation-ids', user?.id],
    queryFn: async (): Promise<string[]> => {
      if (!user?.id) return [];

      const { data: transactions } = await supabase
        .from('transactions')
        .select('conversation_id')
        .or(`user_id.eq.${user.id},buyer_id.eq.${user.id}`)
        .not('conversation_id', 'is', null);

      if (!transactions || transactions.length === 0) return [];

      return transactions
        .map(t => t.conversation_id)
        .filter(Boolean) as string[];
    },
    enabled: !!user?.id,
    staleTime: 60_000, // Cache 1 minute
  });

  // Step 2: Compter les messages non lus avec le hook de base
  const result = useUnreadGlobalBase(
    conversationIds,
    ['unread-transactions-global', user?.id],
    {
      staleTime: 5_000,
      refetchInterval: 10_000,
    }
  );

  return result;
};
