import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

/**
 * Hook pour compter les messages non lus d'une conversation
 */
export function useUnreadConversationMessages(conversationId: string | null | undefined) {
  const { user } = useAuth();

  const { data: unreadCount = 0, refetch } = useQuery({
    queryKey: ['unread-conversation-messages', conversationId],
    queryFn: async (): Promise<number> => {
      if (!conversationId || !user?.id) return 0;

      // Count messages not sent by user
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id);

      if (error) return 0;
      return count || 0;
    },
    enabled: !!conversationId && !!user?.id,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  // Realtime subscription
  useEffect(() => {
    if (!conversationId || !user?.id) return;

    const channel = supabase
      .channel(`conversation-unread-${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload.new as any;
          if (row?.conversation_id === conversationId && row?.sender_id !== user.id) {
            refetch();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user?.id, refetch]);

  return { unreadCount, refetch };
}
