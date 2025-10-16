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
    }

    // Optimistic update
    queryClient.setQueryData(['unread-conversation-messages', conversationId], 0);

    // Invalidate all related queries
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['unread-conversation-messages', conversationId] }),
      queryClient.invalidateQueries({ queryKey: ['unread-quotes-global'] }),
      queryClient.invalidateQueries({ queryKey: ['unread-quote-tabs'] }),
      queryClient.invalidateQueries({ queryKey: ['unread-transactions-global'] }),
      queryClient.invalidateQueries({ queryKey: ['unread-transaction-tabs'] }),
      queryClient.invalidateQueries({ queryKey: ['unread-disputes-global'] }),
    ]);
  }, [queryClient]);

  const getLastSeen = useCallback((conversationId: string): string | null => {
    if (!conversationId) return null;
    const key = `conversation_seen_${conversationId}`;
    return localStorage.getItem(key);
  }, []);

  return { markAsRead, getLastSeen };
};
