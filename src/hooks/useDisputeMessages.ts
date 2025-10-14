import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

export const useDisputeMessages = (disputeId: string, options?: { scope?: 'participant' | 'all' }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch messages for a dispute
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['dispute-messages', disputeId],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');

      let query = supabase
        .from('dispute_messages')
        .select('*')
        .eq('dispute_id', disputeId) as any;

      const scope = options?.scope ?? 'participant';
      if (scope === 'participant') {
        // Get messages where:
        // 1. I'm the sender (my own messages)
        // 2. I'm the recipient (messages addressed to me)
        // 3. Broadcast messages (recipient_id is null) - including initial, text, system
        // Note: Admin messages to other users are filtered client-side
        query = query.or(`sender_id.eq.${user.id},recipient_id.eq.${user.id},recipient_id.is.null`);
      }

      const { data, error } = await query.order('created_at', { ascending: true });

      if (error) throw error;
      
      return data || [];
    },
    enabled: !!user?.id && !!disputeId,
  });

  // Send a new message
  const sendMessage = useMutation({
    mutationFn: async ({ message, messageType = 'text', recipientId = null }: { message: string; messageType?: string; recipientId?: string | null }) => {
      if (!user?.id) throw new Error('User not authenticated');

      // Check message limit (100 messages max per dispute to prevent spam/abuse)
      const { count, error: countError } = await supabase
        .from('dispute_messages')
        .select('*', { count: 'exact', head: true })
        .eq('dispute_id', disputeId);

      if (countError) throw countError;
      
      if (count !== null && count >= 100) {
        throw new Error('Limite de messages atteinte (100 max). Veuillez contacter le support.');
      }

      const { data, error } = await supabase
        .from('dispute_messages')
        .insert({
          dispute_id: disputeId,
          sender_id: user.id,
          message,
          message_type: messageType,
          recipient_id: recipientId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispute-messages', disputeId] });
    },
  });


  // Set up real-time subscription for new messages
  useEffect(() => {
    if (!disputeId) return;

    const channel = supabase
      .channel(`dispute-messages-${disputeId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'dispute_messages',
        },
        (payload) => {
          // Client-side filter: check dispute_id matches
          if (payload.new && (payload.new as any).dispute_id !== disputeId) {
            return;
          }
          queryClient.invalidateQueries({ queryKey: ['dispute-messages', disputeId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [disputeId, queryClient]);

  return {
    messages,
    isLoading,
    sendMessage: sendMessage.mutateAsync,
    isSendingMessage: sendMessage.isPending,
  };
};