import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const ACTIVITY_TYPES_MAP = {
  pending: ['transaction_created', 'buyer_joined_transaction'],
  blocked: ['funds_blocked'],
  disputed: ['dispute_created'],
  completed: ['funds_released', 'transaction_completed', 'seller_validation', 'buyer_validation']
};

const STORAGE_KEYS = {
  pending: 'dashboard_last_seen_pending',
  blocked: 'dashboard_last_seen_blocked',
  disputed: 'dashboard_last_seen_disputed',
  completed: 'dashboard_last_seen_completed'
};

type CategoryKey = keyof typeof ACTIVITY_TYPES_MAP;

export const useNewItemsNotifications = () => {
  const { user } = useAuth();

  const getLastSeenTimestamp = (category: CategoryKey): string | null => {
    return localStorage.getItem(STORAGE_KEYS[category]);
  };

  const markAsSeen = (category: CategoryKey) => {
    localStorage.setItem(STORAGE_KEYS[category], new Date().toISOString());
  };

  const { data: newCounts, refetch } = useQuery({
    queryKey: ['new-items-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const counts: Record<CategoryKey, number> = {
        pending: 0,
        blocked: 0,
        disputed: 0,
        completed: 0
      };

      for (const category of Object.keys(ACTIVITY_TYPES_MAP) as CategoryKey[]) {
        const lastSeen = getLastSeenTimestamp(category);
        
        let query = supabase
          .from('activity_logs')
          .select('id', { count: 'exact', head: true })
          .in('activity_type', ACTIVITY_TYPES_MAP[category]);

        if (lastSeen) {
          query = query.gt('created_at', lastSeen);
        }

        const { count } = await query;
        counts[category] = count || 0;
      }

      return counts;
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  return {
    newCounts: newCounts || { pending: 0, blocked: 0, disputed: 0, completed: 0 },
    markAsSeen,
    refetch
  };
};
