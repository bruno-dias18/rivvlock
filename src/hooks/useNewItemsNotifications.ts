import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const ACTIVITY_TYPES_MAP = {
  pending: ['transaction_created', 'buyer_joined_transaction', 'quote_accepted'],
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
        
        // Récupérer les logs d'activité avec leurs métadonnées
        const { data: logs } = await supabase
          .from('activity_logs')
          .select('id, metadata')
          .eq('user_id', user.id)
          .in('activity_type', ACTIVITY_TYPES_MAP[category])
          .gt('created_at', lastSeen);

        if (!logs || logs.length === 0) {
          counts[category] = 0;
          continue;
        }

        // Extraire les transaction_ids
        const transactionIds = logs
          .map(log => (log.metadata as any)?.transaction_id)
          .filter(Boolean);

        if (transactionIds.length === 0) {
          counts[category] = 0;
          continue;
        }

        // Vérifier le statut actuel des transactions
        let filteredCount = 0;

        if (category === 'pending') {
          const { count } = await supabase
            .from('transactions')
            .select('id', { count: 'exact', head: true })
            .in('id', transactionIds)
            .eq('status', 'pending');
          filteredCount = count || 0;
        } else if (category === 'blocked') {
          const { count } = await supabase
            .from('transactions')
            .select('id', { count: 'exact', head: true })
            .in('id', transactionIds)
            .eq('status', 'paid');
          filteredCount = count || 0;
        } else if (category === 'disputed') {
          const { data: disputes } = await supabase
            .from('disputes')
            .select('transaction_id')
            .in('transaction_id', transactionIds)
            .not('status', 'in', '(resolved,resolved_refund,resolved_release)');
          filteredCount = disputes?.length || 0;
        } else if (category === 'completed') {
          const { count } = await supabase
            .from('transactions')
            .select('id', { count: 'exact', head: true })
            .in('id', transactionIds)
            .eq('status', 'validated');
          filteredCount = count || 0;
        }

        counts[category] = filteredCount;
      }

      return counts;
    },
    enabled: !!user?.id,
    staleTime: 5_000, // 5s pour réactivité immédiate
    refetchInterval: 10_000, // Refetch toutes les 10s en backup
  });

  const getTransactionsWithNewActivity = async (category: CategoryKey): Promise<Set<string>> => {
    if (!user?.id) return new Set();
    
    const lastSeen = getLastSeenTimestamp(category);
    
    const { data } = await supabase
      .from('activity_logs')
      .select('metadata')
      .eq('user_id', user.id)
      .in('activity_type', ACTIVITY_TYPES_MAP[category])
      .gt('created_at', lastSeen);
    
    const transactionIds = data
      ?.map(log => {
        const metadata = log.metadata as any;
        return metadata?.transaction_id;
      })
      .filter(Boolean) || [];
    
    if (transactionIds.length === 0) return new Set();

    // Filtrer par statut actuel
    let filteredIds: string[] = [];

    if (category === 'pending') {
      const { data: txs } = await supabase
        .from('transactions')
        .select('id')
        .in('id', transactionIds)
        .eq('status', 'pending');
      filteredIds = txs?.map(t => t.id) || [];
    } else if (category === 'blocked') {
      const { data: txs } = await supabase
        .from('transactions')
        .select('id')
        .in('id', transactionIds)
        .eq('status', 'paid');
      filteredIds = txs?.map(t => t.id) || [];
    } else if (category === 'disputed') {
      const { data: disputes } = await supabase
        .from('disputes')
        .select('transaction_id')
        .in('transaction_id', transactionIds)
        .not('status', 'in', '(resolved,resolved_refund,resolved_release)');
      filteredIds = disputes?.map(d => d.transaction_id).filter(Boolean) || [];
    } else if (category === 'completed') {
      const { data: txs } = await supabase
        .from('transactions')
        .select('id')
        .in('id', transactionIds)
        .eq('status', 'validated');
      filteredIds = txs?.map(t => t.id) || [];
    }
    
    return new Set(filteredIds);
  };

  return {
    newCounts: newCounts || { pending: 0, blocked: 0, disputed: 0, completed: 0 },
    markAsSeen,
    refetch,
    getTransactionsWithNewActivity
  };
};
