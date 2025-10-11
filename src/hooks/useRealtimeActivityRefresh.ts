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

    // Fonction helper pour invalider avec throttling (max 1x par seconde par query)
    const throttledInvalidate = (queryKey: string[]) => {
      const key = queryKey.join('-');
      const now = Date.now();
      const lastInvalidation = lastInvalidationRef.current[key] || 0;

      if (now - lastInvalidation > 1000) {
        lastInvalidationRef.current[key] = now;
        queryClient.invalidateQueries({ queryKey });
        logger.debug('Realtime: Invalidated cache', { queryKey });
      }
    };

    // Fonction helper pour invalider plusieurs caches avec debouncing
    const invalidateMultiple = (queryKeys: string[][]) => {
      queryKeys.forEach(key => throttledInvalidate(key));
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
      // 2. Changements de statut des transactions
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'transactions',
        },
        (payload) => {
          const transaction = payload.new as any;
          // Vérifier si l'utilisateur est participant
          if (transaction.user_id === user.id || transaction.buyer_id === user.id) {
            logger.debug('Realtime: Transaction updated', payload);
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
      // 4. Nouveaux messages sur les transactions
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transaction_messages',
        },
        (payload) => {
          const message = payload.new as any;
          // Ignorer ses propres messages
          if (message.sender_id === user.id) return;
          
          logger.debug('Realtime: New transaction message', payload);
          invalidateMultiple([
            ['transaction-messages', message.transaction_id],
            ['unread-transaction-messages', message.transaction_id],
            ['unread-transactions-count', user.id],
            ['unread-messages-by-status'],
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
