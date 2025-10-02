import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const ACTIVITY_TYPES_MAP = {
  pending: ['transaction_created', 'buyer_joined_transaction'],
  blocked: ['funds_blocked', 'seller_validation', 'buyer_validation'],
  disputed: [
    'dispute_created',
    'dispute_message_received',
    'dispute_proposal_created',
    'dispute_proposal_accepted',
    'dispute_proposal_rejected',
    'dispute_admin_message',
    'dispute_status_changed'
  ],
  completed: ['funds_released', 'transaction_completed']
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
  const queryClient = useQueryClient();

  const getLastSeenTimestamp = (category: CategoryKey): string => {
    const stored = localStorage.getItem(STORAGE_KEYS[category]);
    // Si null (première visite), initialiser avec la date actuelle pour éviter les notifications historiques
    if (!stored) {
      const now = new Date().toISOString();
      localStorage.setItem(STORAGE_KEYS[category], now);
      return now;
    }
    return stored;
  };

  const markAsSeen = (category: CategoryKey) => {
    localStorage.setItem(STORAGE_KEYS[category], new Date().toISOString());
    // Invalider immédiatement le cache pour faire disparaître les notifications
    queryClient.invalidateQueries({ queryKey: ['new-items-notifications', user?.id] });
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
        
        const { count } = await supabase
          .from('activity_logs')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .in('activity_type', ACTIVITY_TYPES_MAP[category])
          .gt('created_at', lastSeen);

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
