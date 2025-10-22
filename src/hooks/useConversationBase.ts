import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

export interface BaseMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  message: string;
  message_type: string;
  created_at: string;
}

/**
 * Hook de base pour gérer une conversation (messages + temps réel)
 * Utilisé comme fondation pour tous les hooks de conversation
 * 
 * @param conversationId - ID de la conversation
 * @param queryKey - Clé unique pour React Query
 * @returns { messages, isLoading, sendMessage, isSendingMessage }
 */
export function useConversationBase(
  conversationId: string | null | undefined,
  queryKey: readonly unknown[]
) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch messages
  const { data: messages = [], isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<BaseMessage[]> => {
      if (!conversationId) return [];

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(200);

      if (error) throw error;
      return data || [];
    },
    enabled: !!conversationId && !!user?.id,
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      if (!conversationId || !user?.id) {
        throw new Error('Missing conversation or user');
      }

      const { error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        message: content,
        message_type: 'text',
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Real-time subscription
  useEffect(() => {
    if (!conversationId || !user?.id) return;

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          queryClient.setQueryData<BaseMessage[]>(queryKey, (old = []) => {
            const newMessage = payload.new as BaseMessage;
            if (old.some((m) => m.id === newMessage.id)) return old;
            return [...old, newMessage];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user?.id, queryClient, queryKey]);

  return {
    messages,
    isLoading,
    sendMessage: sendMessage.mutateAsync,
    isSendingMessage: sendMessage.isPending,
  };
}
