import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useIsAdmin } from './useIsAdmin';
import { toast } from 'sonner';
import { useEffect, useRef } from 'react';

const STORAGE_KEY = 'admin_last_seen_disputes';

export const useAdminDisputeNotifications = () => {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const previousEscalatedCount = useRef<number | null>(null);

  const getLastSeenTimestamp = (): string | null => {
    return localStorage.getItem(STORAGE_KEY);
  };

  const markAsSeen = () => {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
  };

  const { data: escalatedCount, refetch } = useQuery({
    queryKey: ['admin-dispute-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id || !isAdmin) return 0;

      const lastSeen = getLastSeenTimestamp();
      
      let query = supabase
        .from('disputes')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'escalated');

      if (lastSeen) {
        query = query.gt('escalated_at', lastSeen);
      }

      const { count } = await query;
      return count || 0;
    },
    enabled: !!user?.id && !!isAdmin,
    refetchInterval: 60000, // Réduit à 60s
  });

  // Afficher une notification toast quand de nouveaux litiges sont escaladés
  useEffect(() => {
    if (escalatedCount !== undefined && escalatedCount !== null) {
      if (previousEscalatedCount.current !== null && escalatedCount > previousEscalatedCount.current) {
        const newCount = escalatedCount - previousEscalatedCount.current;
        toast.error(
          `${newCount} nouveau${newCount > 1 ? 'x' : ''} litige${newCount > 1 ? 's escaladés' : ' escaladé'}`,
          {
            description: `${newCount > 1 ? 'Ces litiges nécessitent' : 'Ce litige nécessite'} votre attention immédiate.`,
            duration: 10000,
          }
        );
      }
      previousEscalatedCount.current = escalatedCount;
    }
  }, [escalatedCount]);

  return {
    escalatedCount: escalatedCount || 0,
    markAsSeen,
    refetch
  };
};
