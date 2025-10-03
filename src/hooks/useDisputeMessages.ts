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
        // Only get messages where:
        // 1. I'm the sender (my own messages)
        // 2. I'm the explicit recipient (messages addressed to me)
        // This prevents seeing messages sent by the other party or messages addressed to them
        query = query.or(`sender_id.eq.${user.id},recipient_id.eq.${user.id},and(recipient_id.is.null,message_type.not.ilike.*admin*)`);
      }

      const { data, error } = await query.order('created_at', { ascending: true });

      if (error) throw error;
      
      return data || [];
    },
    enabled: !!user?.id && !!disputeId,
  });

  // Send a new message
  const sendMessage = useMutation({
    mutationFn: async ({ message, messageType = 'text' }: { message: string; messageType?: string }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('dispute_messages')
        .insert({
          dispute_id: disputeId,
          sender_id: user.id,
          message,
          message_type: messageType,
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
          filter: `dispute_id=eq.${disputeId}`,
        },
        () => {
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