import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

/**
 * Hook pour marquer une conversation comme lue
 * Utilise la DB (conversation_reads) comme source de vérité
 */
export const useMarkConversationAsRead = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const markAsRead = useCallback(async (conversationId: string) => {
    if (!conversationId || !user?.id) return;

    // Récupérer le timestamp du dernier message côté serveur
    const { data: latest } = await supabase
      .from('messages')
      .select('created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastReadAt = latest?.created_at ?? new Date().toISOString();

    // Upsert dans conversation_reads (source de vérité serveur)
    const { error } = await supabase
      .from('conversation_reads')
      .upsert({
        user_id: user.id,
        conversation_id: conversationId,
        last_read_at: lastReadAt,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,conversation_id'
      });

    if (error) {
      logger.error('Failed to mark conversation as read', { conversationId, error: String(error) });
      return;
    }

    logger.debug('Marked conversation as read', { conversationId, lastReadAt });

    // Mise à jour optimiste immédiate du badge à 0
    queryClient.setQueryData(['unread-conversation-messages', conversationId, user.id], 0);

    // Force refetch pour confirmation serveur
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['unread-conversation-messages', conversationId, user.id] }),
      queryClient.refetchQueries({ queryKey: ['unread-quotes-global'] }),
      queryClient.refetchQueries({ queryKey: ['unread-quote-tabs'] }),
      queryClient.refetchQueries({ queryKey: ['unread-transactions-global'] }),
      queryClient.refetchQueries({ queryKey: ['unread-transaction-tabs'] }),
    ]);
  }, [queryClient, user]);

  return { markAsRead };
};
