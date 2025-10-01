import { useState, useEffect, useCallback, useRef } from 'react';
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

interface UseTransactionMessagesOptions {
  enabled?: boolean;
}

export function useTransactionMessages(
  transactionId: string, 
  currentUserId: string,
  options?: UseTransactionMessagesOptions
) {
  const [messages, setMessages] = useState<TransactionMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout>();

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

  // Refetch function
  const refetch = useCallback(async () => {
    if (!transactionId) return;
    
    const { data, error } = await supabase
      .from('transaction_messages')
      .select('*')
      .eq('transaction_id', transactionId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data);
    }
  }, [transactionId]);

  // Initial fetch
  useEffect(() => {
    const fetchMessages = async () => {
      setIsLoading(true);
      await refetch();
      setIsLoading(false);
    };

    if (transactionId) {
      fetchMessages();
    }
  }, [transactionId, refetch]);

  // Real-time subscription with schema-db-changes
  useEffect(() => {
    if (!transactionId) return;

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transaction_messages',
          filter: `transaction_id=eq.${transactionId}`,
        },
        async (payload) => {
          const newMessage = payload.new as TransactionMessage;
          
          // Remplacer le message optimiste par le vrai message
          setMessages((prev) => {
            const tempMessageIndex = prev.findIndex(
              msg => msg.id.startsWith('temp-') && 
              msg.message === newMessage.message &&
              msg.sender_id === newMessage.sender_id
            );
            
            if (tempMessageIndex !== -1) {
              const updated = [...prev];
              updated[tempMessageIndex] = newMessage;
              return updated;
            } else {
              return [...prev, newMessage];
            }
          });

          // Pas besoin de refetch ici, on a déjà le message dans l'état
          // await refetch(); - SUPPRIMÉ pour améliorer les performances
          
          // Notification seulement si ce n'est pas mon propre message
          if (newMessage.sender_id !== currentUserId) {
            toast.info('💬 Nouveau message reçu', {
              description: newMessage.message.length > 50 
                ? newMessage.message.substring(0, 50) + '...' 
                : newMessage.message
            });
          }
        }
      )
      .subscribe(); // Pas de refetch ici non plus pour améliorer les performances

    return () => {
      supabase.removeChannel(channel);
    };
  }, [transactionId, currentUserId, refetch]);

  // Polling fallback when enabled (réduit à 15 secondes pour réduire la charge)
  useEffect(() => {
    if (!options?.enabled || !transactionId) return;

    pollingIntervalRef.current = setInterval(() => {
      refetch();
    }, 15000); // Augmenté de 5s à 15s

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [transactionId, options?.enabled, refetch]);

  // Refetch on tab focus when enabled
  useEffect(() => {
    if (!options?.enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refetch();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [options?.enabled, refetch]);

  const sendMessage = async (message: string, recipientId: string) => {
    if (isBlocked) {
      toast.error('La messagerie est bloquée car le litige a été escaladé');
      return false;
    }

    if (!message.trim() || message.length > 1000) {
      toast.error('Message invalide (1-1000 caractères)');
      return false;
    }

    // Créer un message optimiste
    const tempMessage: TransactionMessage = {
      id: `temp-${Date.now()}`,
      transaction_id: transactionId,
      sender_id: currentUserId,
      recipient_id: recipientId,
      message: message.trim(),
      created_at: new Date().toISOString(),
    };

    // Ajouter immédiatement le message à l'état
    setMessages((prev) => [...prev, tempMessage]);

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
      
      // Supprimer le message optimiste en cas d'erreur
      setMessages((prev) => prev.filter(msg => msg.id !== tempMessage.id));
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
