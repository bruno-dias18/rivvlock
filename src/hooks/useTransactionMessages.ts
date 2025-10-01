import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TransactionMessage {
  id: string;
  transaction_id: string;
  sender_id: string;
  recipient_id: string;
  message: string;
  created_at: string;
}

export function useTransactionMessages(transactionId: string, currentUserId: string) {
  const [messages, setMessages] = useState<TransactionMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);

  // Check if messaging is blocked due to escalated dispute
  useEffect(() => {
    const checkDisputeStatus = async () => {
      const { data: dispute } = await supabase
        .from('disputes')
        .select('escalated_at')
        .eq('transaction_id', transactionId)
        .maybeSingle();

      setIsBlocked(!!dispute?.escalated_at);
    };

    checkDisputeStatus();
  }, [transactionId]);

  // Fetch messages
  useEffect(() => {
    const fetchMessages = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('transaction_messages')
        .select('*')
        .eq('transaction_id', transactionId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        toast.error('Erreur lors du chargement des messages');
      } else {
        setMessages(data || []);
      }
      setIsLoading(false);
    };

    if (transactionId) {
      fetchMessages();
    }
  }, [transactionId]);

  // Real-time subscription
  useEffect(() => {
    if (!transactionId) return;

    const channel = supabase
      .channel(`transaction_messages:${transactionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transaction_messages',
          filter: `transaction_id=eq.${transactionId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as TransactionMessage]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [transactionId]);

  const sendMessage = async (message: string, recipientId: string) => {
    if (isBlocked) {
      toast.error('La messagerie est bloquée car le litige a été escaladé');
      return false;
    }

    if (!message.trim() || message.length > 1000) {
      toast.error('Message invalide (1-1000 caractères)');
      return false;
    }

    try {
      const { error } = await supabase.functions.invoke('send-transaction-message', {
        body: {
          transactionId,
          recipientId,
          message: message.trim(),
        },
      });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Erreur lors de l\'envoi du message');
      return false;
    }
  };

  return {
    messages,
    isLoading,
    isBlocked,
    sendMessage,
  };
}
