import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY_PREFIX = 'transaction_messages_last_seen_';

export function useTransactionNewMessages(transactions: any[], currentUserId: string) {
  const [newMessagesMap, setNewMessagesMap] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    if (!transactions || transactions.length === 0 || !currentUserId) {
      setNewMessagesMap(new Map());
      return;
    }

    const checkNewMessages = async () => {
      const newMap = new Map<string, boolean>();

      for (const transaction of transactions) {
        const transactionId = transaction.id;
        const storageKey = `${STORAGE_KEY_PREFIX}${transactionId}`;
        const lastSeenStr = localStorage.getItem(storageKey);
        const lastSeenTimestamp = lastSeenStr ? new Date(lastSeenStr).getTime() : 0;

        // Récupérer le dernier message de cette transaction
        const { data: messages } = await supabase
          .from('transaction_messages')
          .select('*')
          .eq('transaction_id', transactionId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (messages && messages.length > 0) {
          const lastMessage = messages[0];
          const lastMessageTimestamp = new Date(lastMessage.created_at).getTime();
          
          // Il y a un nouveau message si :
          // 1. Le dernier message est plus récent que le dernier vu
          // 2. Le dernier message n'est pas de l'utilisateur actuel
          const hasNewMessage = 
            lastMessageTimestamp > lastSeenTimestamp && 
            lastMessage.sender_id !== currentUserId;
          
          newMap.set(transactionId, hasNewMessage);
        } else {
          newMap.set(transactionId, false);
        }
      }

      setNewMessagesMap(newMap);
    };

    checkNewMessages();
  }, [transactions, currentUserId]);

  const markAsRead = (transactionId: string) => {
    const storageKey = `${STORAGE_KEY_PREFIX}${transactionId}`;
    localStorage.setItem(storageKey, new Date().toISOString());
    
    // Mettre à jour immédiatement le state
    setNewMessagesMap(prev => {
      const newMap = new Map(prev);
      newMap.set(transactionId, false);
      return newMap;
    });
  };

  return { newMessagesMap, markAsRead };
}
