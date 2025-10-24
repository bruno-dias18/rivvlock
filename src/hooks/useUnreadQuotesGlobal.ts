import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUnreadGlobalBase } from './useUnreadGlobalBase';

/**
 * Hook pour compter le nombre total de messages non lus dans tous les devis de l'utilisateur
 * Utilise useUnreadGlobalBase comme fondation
 */
export const useUnreadQuotesGlobal = () => {
  const { user } = useAuth();

  // Step 1: Récupérer les IDs de conversations
  const { data: conversationIds } = useQuery({
    queryKey: ['quote-conversation-ids', user?.id],
    queryFn: async (): Promise<string[]> => {
      if (!user?.id) return [];

      // Exclure les devis acceptés (notifications gérées par la transaction)
      const { data: quotes } = await supabase
        .from('quotes')
        .select('conversation_id')
        .or(`seller_id.eq.${user.id},client_user_id.eq.${user.id}`)
        .not('conversation_id', 'is', null)
        .neq('status', 'accepted');

      if (!quotes || quotes.length === 0) return [];

      return quotes
        .map(q => q.conversation_id)
        .filter(Boolean) as string[];
    },
    enabled: !!user?.id,
    staleTime: 60_000, // Cache 1 minute
  });

  // Step 2: Compter les messages non lus avec le hook de base
  const result = useUnreadGlobalBase(
    conversationIds,
    ['unread-quotes-global', user?.id],
    {
      staleTime: 5_000,
      refetchInterval: 20_000,
    }
  );

  return result;
};
