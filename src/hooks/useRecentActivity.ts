import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface ActivityLog {
  id: string;
  activity_type: string;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  created_at: string;
  transaction?: {
    id: string;
    title: string;
  } | null;
}

// Types d'activités à afficher dans l'activité récente
const RELEVANT_ACTIVITY_TYPES = [
  'transaction_created', 
  'buyer_joined_transaction',
  'funds_blocked',
  'funds_released',
  'transaction_completed',
  'dispute_created',
  'seller_validation',
  'buyer_validation'
];

export const useRecentActivity = () => {
  return useQuery({
    queryKey: ['recent-activity'],
    queryFn: async () => {
      // First, get activity logs
      const { data: activities, error } = await supabase
        .from('activity_logs')
        .select('*')
        .in('activity_type', RELEVANT_ACTIVITY_TYPES)
        .order('created_at', { ascending: false })
        .limit(4);

      if (error) {
        logger.error('Error fetching recent activity:', error);
        throw error;
      }

      if (!activities || activities.length === 0) {
        return [];
      }

      // Get unique transaction IDs from metadata
      const transactionIds = activities
        .map(activity => {
          const metadata = activity.metadata as Record<string, any> | null;
          return metadata?.transaction_id;
        })
        .filter(Boolean);

      let transactionsMap = new Map();

      if (transactionIds.length > 0) {
        // Fetch transaction titles
        const { data: transactions, error: transactionError } = await supabase
          .from('transactions')
          .select('id, title')
          .in('id', transactionIds);

        if (!transactionError && transactions) {
          transactionsMap = new Map(transactions.map(t => [t.id, t]));
        }
      }

      // Combine activities with transaction data
      return activities.map(activity => {
        const metadata = activity.metadata as Record<string, any> | null;
        const transactionId = metadata?.transaction_id;
        
        return {
          ...activity,
          transaction: transactionId 
            ? transactionsMap.get(transactionId) || null
            : null
        };
      }) as ActivityLog[];
    },
  });
};