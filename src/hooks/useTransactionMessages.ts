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
  pending?: boolean; // Pour indiquer un message en cours d'envoi
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

  // Real-time subscription with unique channel per transaction
  useEffect(() => {
    if (!transactionId) return;

    const channelName = `transaction-messages-${transactionId}`;
    
    const channel = supabase
      .channel(channelName)
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
      .subscribe((status) => {
        // Reconnecter automatiquement en cas d'erreur
        if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
          console.log(`[Realtime] Channel ${channelName} error/closed, reconnecting...`);
          setTimeout(() => {
            supabase.removeChannel(channel);
            // Le useEffect se ré-exécutera et créera un nouveau canal
          }, 1000);
        }
      });

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

    // Créer un message optimiste avec indicateur pending
    const tempMessage: TransactionMessage = {
      id: `temp-${Date.now()}`,
      transaction_id: transactionId,
      sender_id: currentUserId,
      recipient_id: recipientId,
      message: message.trim(),
      created_at: new Date().toISOString(),
      pending: true,
    };

    // Ajouter immédiatement le message à l'état
    setMessages((prev) => [...prev, tempMessage]);

    try {
      // Créer une promesse avec timeout personnalisé de 8 secondes
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('TIMEOUT')), 8000);
      });

      const invokePromise = supabase.functions.invoke('send-transaction-message', {
        body: {
          transactionId,
          recipientId,
          message: message.trim(),
        },
      });

      const { error } = await Promise.race([invokePromise, timeoutPromise]) as any;

      if (error) throw error;
      
      // Retirer le flag pending du message
      setMessages((prev) => 
        prev.map(msg => msg.id === tempMessage.id ? { ...msg, pending: false } : msg)
      );
      
      return true;
    } catch (error: any) {
      console.error('Error sending message:', error);
      
      const errorMessage = error?.message || '';
      const isTimeoutOrNetworkError = 
        errorMessage === 'TIMEOUT' || 
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('NetworkError') ||
        error?.status >= 500;

      if (isTimeoutOrNetworkError) {
        // Erreur réseau/timeout : garder le message optimiste avec statut "Envoi..."
        console.log('[SendMessage] Timeout/network error, keeping optimistic message');
        
        // Refetch après 2 secondes pour synchroniser
        setTimeout(() => {
          refetch();
        }, 2000);
        
        return true; // Ne pas afficher d'erreur à l'utilisateur
      } else {
        // Erreur fonctionnelle (4xx) : supprimer le message optimiste et afficher l'erreur
        toast.error('Erreur lors de l\'envoi du message');
        setMessages((prev) => prev.filter(msg => msg.id !== tempMessage.id));
        return false;
      }
    }
  };

  return {
    messages,
    isLoading,
    isBlocked,
    sendMessage,
  };
}
