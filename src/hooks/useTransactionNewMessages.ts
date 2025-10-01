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
      
      // Filtrer les transactions avec des IDs valides
      const validTransactions = transactions.filter(t => t?.id && typeof t.id === 'string' && t.id.length > 0);
      
      if (validTransactions.length === 0) {
        setNewMessagesMap(new Map());
        return;
      }
      
      const transactionIds = validTransactions.map(t => t.id);

      // Optimisation : Une seule requête pour tous les derniers messages
      const { data: allMessages, error } = await supabase
        .from('transaction_messages')
        .select('*')
        .in('transaction_id', transactionIds)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching transaction messages:', error);
        setNewMessagesMap(new Map());
        return;
      }

      // Grouper les messages par transaction et garder seulement le plus récent
      const lastMessagesByTransaction = new Map<string, any>();
      if (allMessages && allMessages.length > 0) {
        for (const message of allMessages) {
          if (!lastMessagesByTransaction.has(message.transaction_id)) {
            lastMessagesByTransaction.set(message.transaction_id, message);
          }
        }
      }

      // Vérifier pour chaque transaction s'il y a un nouveau message
      for (const transaction of validTransactions) {
        const transactionId = transaction.id;
        const storageKey = `${STORAGE_KEY_PREFIX}${transactionId}`;
        const lastSeenStr = localStorage.getItem(storageKey);
        const lastSeenTimestamp = lastSeenStr ? new Date(lastSeenStr).getTime() : 0;

        const lastMessage = lastMessagesByTransaction.get(transactionId);

        if (lastMessage) {
          const lastMessageTimestamp = new Date(lastMessage.created_at).getTime();
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
