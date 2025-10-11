import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface EscalatedDisputeMessagingOptions {
  disputeId: string;
  transactionId: string;
}

export const useEscalatedDisputeMessaging = ({ disputeId, transactionId }: EscalatedDisputeMessagingOptions) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Determine if current user is seller or buyer
  const { data: transaction } = useQuery({
    queryKey: ['transaction-role', transactionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('user_id, buyer_id')
        .eq('id', transactionId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!transactionId && !!user?.id,
  });

  const isSeller = transaction?.user_id === user?.id;
  const isRoleReady = Boolean(transaction?.user_id && transaction?.buyer_id);
  const messageType = isSeller ? 'seller_to_admin' : 'buyer_to_admin';
  const adminMessageType = isSeller ? 'admin_to_seller' : 'admin_to_buyer';

  // Fetch only messages in private thread with admin
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['escalated-dispute-messages', disputeId, user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('dispute_messages')
        .select('*')
        .eq('dispute_id', disputeId)
        .or(`and(sender_id.eq.${user.id},message_type.eq.${messageType}),and(recipient_id.eq.${user.id},message_type.eq.${adminMessageType})`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && !!disputeId && !!transaction,
  });

  const sendMessageToAdmin = useMutation({
    mutationFn: async ({ message }: { message: string }) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      // CRITICAL: Re-fetch transaction to guarantee correct message_type
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('user_id, buyer_id')
        .eq('id', transactionId)
        .single();
      
      if (txError || !txData) throw new Error('Transaction not found');
      
      // Calculate type AFTER having transaction data
      const computedIsSeller = txData.user_id === user.id;
      const computedMessageType = computedIsSeller ? 'seller_to_admin' : 'buyer_to_admin';
      
      const { error } = await supabase
        .from('dispute_messages')
        .insert({
          dispute_id: disputeId,
          sender_id: user.id,
          recipient_id: user.id, // Self-recipient to keep private from counterparty
          message: message.trim(),
          message_type: computedMessageType,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['escalated-dispute-messages', disputeId] });
      queryClient.invalidateQueries({ queryKey: ['admin-dispute-messages', disputeId] });
    },
  });

  // Real-time subscription
  useEffect(() => {
    if (!disputeId || !user?.id) return;

    const channel = supabase
      .channel(`escalated-dispute-${disputeId}-${user.id}`)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'dispute_messages',
          filter: `dispute_id=eq.${disputeId}`
        },
        (payload) => {
          const msg = payload.new as any;
          // Only invalidate if message is relevant to this user
          if (
            (msg.sender_id === user.id && msg.message_type === messageType) ||
            (msg.recipient_id === user.id && msg.message_type === adminMessageType)
          ) {
            queryClient.invalidateQueries({ queryKey: ['escalated-dispute-messages', disputeId, user.id] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [disputeId, user?.id, messageType, adminMessageType, queryClient]);

  return {
    messages,
    isLoading,
    isSeller,
    isRoleReady,
    sendMessage: sendMessageToAdmin.mutateAsync,
    isSending: sendMessageToAdmin.isPending,
  };
};
