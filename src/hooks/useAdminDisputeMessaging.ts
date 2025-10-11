import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AdminDisputeMessagingOptions {
  disputeId: string;
  sellerId: string;
  buyerId: string;
}

export const useAdminDisputeMessaging = ({ disputeId, sellerId, buyerId }: AdminDisputeMessagingOptions) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: allMessages = [], isLoading } = useQuery({
    queryKey: ['admin-dispute-messages', disputeId],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('dispute_messages')
        .select('*')
        .eq('dispute_id', disputeId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return data || [];
    },
    enabled: !!user?.id && !!disputeId,
  });

  // Split messages into two private threads
  const messagesToSeller = allMessages.filter(
    (msg: any) =>
      // Admin -> Seller
      msg.message_type === 'admin_to_seller' ||
      // Seller -> Admin (explicit to_admin type)
      (msg.sender_id === sellerId && msg.message_type === 'seller_to_admin') ||
      // Seller -> Admin (self-recipient to keep private)
      (msg.sender_id === sellerId && msg.recipient_id === sellerId) ||
      // Seller -> Admin (with recipient_id pointing to admin)
      (msg.sender_id === sellerId && msg.recipient_id === user?.id) ||
      // Seller -> Admin (legacy, no recipient)
      (msg.sender_id === sellerId && !msg.recipient_id)
  );

  const messagesToBuyer = allMessages.filter(
    (msg: any) =>
      // Admin -> Buyer
      msg.message_type === 'admin_to_buyer' ||
      // Buyer -> Admin (explicit to_admin type)
      (msg.sender_id === buyerId && msg.message_type === 'buyer_to_admin') ||
      // Buyer -> Admin (self-recipient to keep private)
      (msg.sender_id === buyerId && msg.recipient_id === buyerId) ||
      // Buyer -> Admin (with recipient_id pointing to admin)
      (msg.sender_id === buyerId && msg.recipient_id === user?.id) ||
      // Buyer -> Admin (legacy, no recipient)
      (msg.sender_id === buyerId && !msg.recipient_id)
  );

  // DEBUG LOG (temporary - will remove after validation)
  console.log('[ADMIN DISPUTE THREADS]', {
    total: allMessages.length,
    toSeller: messagesToSeller.length,
    toBuyer: messagesToBuyer.length,
    sellerId,
    buyerId
  });

  const sendToSeller = useMutation({
    mutationFn: async ({ message }: { message: string }) => {
      if (!user?.id) throw new Error('User not authenticated');
      const { error } = await supabase
        .from('dispute_messages')
        .insert({
          dispute_id: disputeId,
          sender_id: user.id,
          recipient_id: sellerId,
          message: message.trim(),
          message_type: 'admin_to_seller',
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-dispute-messages', disputeId] });
      queryClient.invalidateQueries({ queryKey: ['dispute-messages', disputeId] });
    },
  });

  const sendToBuyer = useMutation({
    mutationFn: async ({ message }: { message: string }) => {
      if (!user?.id) throw new Error('User not authenticated');
      const { error } = await supabase
        .from('dispute_messages')
        .insert({
          dispute_id: disputeId,
          sender_id: user.id,
          recipient_id: buyerId,
          message: message.trim(),
          message_type: 'admin_to_buyer',
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-dispute-messages', disputeId] });
      queryClient.invalidateQueries({ queryKey: ['dispute-messages', disputeId] });
    },
  });

  useEffect(() => {
    if (!disputeId) return;
    const channel = supabase
      .channel(`admin-dispute-messages-${disputeId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dispute_messages' },
        (payload) => {
          // Client-side filter: check dispute_id matches
          if (payload.new && (payload.new as any).dispute_id !== disputeId) {
            return;
          }
          queryClient.invalidateQueries({ queryKey: ['admin-dispute-messages', disputeId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [disputeId, queryClient]);

  return {
    isLoading,
    messagesToSeller,
    messagesToBuyer,
    sendToSeller: sendToSeller.mutateAsync,
    sendToBuyer: sendToBuyer.mutateAsync,
    isSendingToSeller: sendToSeller.isPending,
    isSendingToBuyer: sendToBuyer.isPending,
  };
};
