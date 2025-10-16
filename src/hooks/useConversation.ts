import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useRef } from 'react';

interface UnifiedMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  message: string;
  message_type: 'text' | 'system' | 'proposal_update';
  metadata: Record<string, any> | null;
  created_at: string;
}

export const useConversation = (conversationId: string | null | undefined) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const lastInvalidationRef = useRef<number>(0);

  const { data: messages = [], isLoading } = useQuery<UnifiedMessage[]>({
    queryKey: ['conversation-messages', conversationId],
    queryFn: async () => {
      if (!user?.id || !conversationId) throw new Error('Missing user or conversation');

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(200);

      if (error) throw error;
      return (data as UnifiedMessage[]) || [];
    },
    enabled: !!user?.id && !!conversationId,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: 10_000, // Fallback polling every 10s if Realtime fails
  });

  const sendMessage = useMutation({
    mutationFn: async ({ message }: { message: string }) => {
      if (!user?.id || !conversationId) throw new Error('Missing user or conversation');

      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          message: message.trim().slice(0, 1000),
          message_type: 'text',
        })
        .select()
        .single();

      if (error) throw error;
      return data as UnifiedMessage;
    },
    onSuccess: () => {
      if (!conversationId) return;
      queryClient.invalidateQueries({ queryKey: ['conversation-messages', conversationId] });
    },
  });

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload.new as UnifiedMessage | undefined;
          if (!row || row.conversation_id !== conversationId) return;

          // Optimistic update immédiat sans throttling
          queryClient.setQueryData<UnifiedMessage[]>(
            ['conversation-messages', conversationId],
            (old = []) => {
              const exists = old.some(msg => msg.id === row.id);
              if (exists) return old;
              return [...old, row];
            }
          );
        }
      )
      .subscribe();

    return () => {
      try { 
        supabase.removeChannel(channel); 
      } catch {}
    };
  }, [conversationId, queryClient]);

  return {
    messages,
    isLoading,
    sendMessage: sendMessage.mutateAsync,
    isSendingMessage: sendMessage.isPending,
  };
};
