import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUnreadGlobalBase } from './useUnreadGlobalBase';

export const useUnreadDisputesGlobal = () => {
  const { user } = useAuth();

  // Step 1: Récupérer les IDs de conversations des disputes actifs
  const { data: conversationIds } = useQuery({
    queryKey: ['dispute-conversation-ids', user?.id],
    queryFn: async (): Promise<string[]> => {
      if (!user?.id) return [];

      // Get all active disputes
      const { data: disputes, error: disputesError } = await supabase
        .from('disputes')
        .select('id, conversation_id, status')
        .not('status', 'in', '(resolved,resolved_refund,resolved_release)');
      
      if (disputesError) throw disputesError;
      if (!disputes || !disputes.length) return [];

      return disputes
        .map((d) => d.conversation_id)
        .filter((id): id is string => id !== null);
    },
    enabled: !!user?.id,
    staleTime: 60_000, // Cache 1 minute
  });

  // Step 2: Compter les messages non lus avec le hook de base
  const { unreadCount, refetch, isLoading } = useUnreadGlobalBase(
    conversationIds,
    ['unread-disputes-global', user?.id],
    {
      staleTime: 5_000,
      refetchInterval: 10_000,
    }
  );

  const markAllAsSeen = () => {
    // No-op, marking is handled per conversation now
    refetch();
  };

  return { unreadCount, markAllAsSeen, refetch, isLoading };
};
