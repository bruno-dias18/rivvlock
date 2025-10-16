import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';

/**
 * Hook central pour le rafraîchissement automatique en temps réel
 * Écoute tous les changements pertinents via Supabase Realtime
 * et invalide intelligemment les caches React Query
 */
export const useRealtimeActivityRefresh = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const lastInvalidationRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!user?.id) return;

    // Fonction helper pour refetch avec throttling (max 1x toutes les 3 secondes par query)
    const throttledRefetch = (queryKey: string[]) => {
      const key = queryKey.join('-');
      const now = Date.now();
      const lastRefetch = lastInvalidationRef.current[key] || 0;

      if (now - lastRefetch > 3000) {
        lastInvalidationRef.current[key] = now;
        // ✅ Force refetch immédiat (ignore staleTime) pour mise à jour instantanée
        queryClient.refetchQueries({ queryKey, type: 'active' });
        logger.info('🔄 Realtime: Force refetch', { queryKey });
      }
    };

    // Fonction helper pour refetch plusieurs caches avec throttling
    const invalidateMultiple = (queryKeys: string[][]) => {
      queryKeys.forEach(key => throttledRefetch(key));
    };

    const channel = supabase
      .channel(`realtime-activity-${user.id}`)
      // 1. Nouveaux logs d'activité de l'utilisateur
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_logs',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          logger.debug('Realtime: New activity log', payload);
          invalidateMultiple([
            ['activity-logs', user.id],
            ['new-items-notifications', user.id],
          ]);
        }
      )
      // 2. Changements de statut des transactions (INSERT + UPDATE)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
        },
        (payload) => {
          const transaction = payload.new as any;
          // Vérifier si l'utilisateur est participant
          if (transaction.user_id === user.id || transaction.buyer_id === user.id) {
            logger.info('🔄 Realtime: Transaction changed', payload);
            invalidateMultiple([
              ['transactions', user.id],
              ['transaction-counts', user.id],
              ['new-items-notifications', user.id],
              ['unread-transactions-count', user.id],
            ]);
          }
        }
      )
      // 3. Nouveaux litiges ou changements de statut
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'disputes',
        },
        (payload) => {
          logger.debug('Realtime: New dispute', payload);
          invalidateMultiple([
            ['disputes', user.id],
            ['new-items-notifications', user.id],
            ['unread-disputes-global', user.id],
          ]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'disputes',
        },
        (payload) => {
          logger.debug('Realtime: Dispute updated', payload);
          invalidateMultiple([
            ['disputes', user.id],
            ['new-items-notifications', user.id],
            ['unread-disputes-global', user.id],
          ]);
        }
      )
      // 4. Nouveaux messages sur conversations (transactions et quotes)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const message = payload.new as any;
          // Ignorer ses propres messages
          if (message.sender_id === user.id) return;
          
          logger.debug('Realtime: New message', payload);

          // ✅ Mise à jour optimiste immédiate du badge "Discussion"
          const lastSeenKey = `conversation_seen_${message.conversation_id}`;
          const lastSeen = localStorage.getItem(lastSeenKey);
          if (!lastSeen || message.created_at > lastSeen) {
            queryClient.setQueryData<number>(
              ['unread-conversation-messages', message.conversation_id],
              (prev) => Math.max(0, (typeof prev === 'number' ? prev : 0) + 1)
            );
          }

          // Refetch pour confirmation serveur (throttle 3s)
          invalidateMultiple([
            ['conversation-messages', message.conversation_id],
            ['unread-conversation-messages', message.conversation_id],
            ['unread-transactions-global', user.id],
            ['unread-quotes-global', user.id],
            ['unread-transaction-tabs', user.id],
            ['unread-quote-tabs', user.id],
          ]);
        }
      )
      // 5. Nouveaux messages sur les litiges
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'dispute_messages',
        },
        (payload) => {
          const message = payload.new as any;
          // Ignorer ses propres messages
          if (message.sender_id === user.id) return;
          
          logger.debug('Realtime: New dispute message', payload);
          invalidateMultiple([
            ['dispute-messages', message.dispute_id],
            ['unread-dispute-messages', message.dispute_id, user.id],
            ['unread-disputes-global', user.id],
            ['unread-admin-messages', user.id],
          ]);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.info('Realtime: Connected successfully');
        } else if (status === 'CHANNEL_ERROR') {
          logger.error('Realtime: Connection error');
        } else if (status === 'TIMED_OUT') {
          logger.warn('Realtime: Connection timeout');
        }
      });

    return () => {
      supabase.removeChannel(channel);
      logger.debug('Realtime: Disconnected');
    };
  }, [user?.id, queryClient]);
};
