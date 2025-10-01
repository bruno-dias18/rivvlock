import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useRef } from 'react';

export const useTransactionMessages = (transactionId: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const lastInvalidationRef = useRef<number>(0);

  // Fetch messages with intelligent caching
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['transaction-messages', transactionId],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('transaction_messages')
        .select('*')
        .eq('transaction_id', transactionId)
        .order('created_at', { ascending: true })
        .limit(50); // Reasonable limit for UI performance

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && !!transactionId,
    staleTime: 5 * 60 * 1000, // 5 minutes - critical optimization
    gcTime: 10 * 60 * 1000, // 10 minutes cache
    refetchOnWindowFocus: false, // Prevent unnecessary refetches
  });

  // Send a new message
  const sendMessage = useMutation({
    mutationFn: async ({ message }: { message: string }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('transaction_messages')
        .insert({
          transaction_id: transactionId,
          sender_id: user.id,
          message: message.trim().substring(0, 1000), // Enforce limit
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaction-messages', transactionId] });
    },
  });

  // Throttled real-time subscription
  useEffect(() => {
    if (!transactionId) return;

    const channel = supabase
      .channel(`transaction-messages-${transactionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transaction_messages',
          filter: `transaction_id=eq.${transactionId}`,
        },
        () => {
          // Throttle: max 1 invalidation per second
          const now = Date.now();
          if (now - lastInvalidationRef.current > 1000) {
            lastInvalidationRef.current = now;
            queryClient.invalidateQueries({ queryKey: ['transaction-messages', transactionId] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [transactionId, queryClient]);

  // Mark messages as read
  const markAsRead = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase.functions.invoke('mark-messages-read', {
        body: { transactionId },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unread-transaction-messages', transactionId] });
      queryClient.invalidateQueries({ queryKey: ['unread-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['unread-messages-by-status'] });
    },
  });

  return {
    messages,
    isLoading,
    sendMessage: sendMessage.mutateAsync,
    isSendingMessage: sendMessage.isPending,
    markAsRead: markAsRead.mutateAsync,
    isMarkingAsRead: markAsRead.isPending,
  };
};
