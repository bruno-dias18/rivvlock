import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook pour marquer une conversation comme lue
 * Utilise la DB (conversation_reads) comme source de vérité
 */
export const useMarkConversationAsRead = () => {
  const queryClient = useQueryClient();

  const markAsRead = useCallback(async (conversationId: string) => {
    if (!conversationId) return;

    // Get latest message timestamp from server
    const { data: latest } = await supabase
      .from('messages')
      .select('created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastReadAt = latest?.created_at ?? new Date().toISOString();

    // Upsert to DB (source of truth)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('conversation_reads')
        .upsert({
          user_id: user.id,
          conversation_id: conversationId,
          last_read_at: lastReadAt,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,conversation_id'
        });

      // Optimistic update - both key variants
      queryClient.setQueryData(['unread-conversation-messages', conversationId, user.id], 0);
      queryClient.setQueryData(['unread-conversation-messages', conversationId], 0); // compat

      // Refetch all related queries with exact keys
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['unread-conversation-messages', conversationId, user.id], type: 'all' }),
        queryClient.refetchQueries({ queryKey: ['unread-conversation-messages', conversationId], type: 'all' }),
        queryClient.refetchQueries({ queryKey: ['unread-quotes-global'], type: 'all' }),
        queryClient.refetchQueries({ queryKey: ['unread-quote-tabs'], type: 'all' }),
        queryClient.refetchQueries({ queryKey: ['unread-transactions-global'], type: 'all' }),
        queryClient.refetchQueries({ queryKey: ['unread-transaction-tabs'], type: 'all' }),
        queryClient.refetchQueries({ queryKey: ['unread-disputes-global'], type: 'all' }),
      ]);
    }
  }, [queryClient]);

  const getLastSeen = useCallback((conversationId: string): string | null => {
    if (!conversationId) return null;
    const key = `conversation_seen_${conversationId}`;
    return localStorage.getItem(key);
  }, []);

  return { markAsRead, getLastSeen };
};
