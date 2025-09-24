import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ActivityLog {
  id: string;
  activity_type: string;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

// Types d'activités à afficher dans l'activité récente
const RELEVANT_ACTIVITY_TYPES = [
  'transaction_joined',
  'transaction_created', 
  'funds_blocked',
  'funds_released',
  'dispute_created',
  'seller_validation',
  'buyer_validation'
];

export const useRecentActivity = () => {
  return useQuery({
    queryKey: ['recent-activity'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .in('activity_type', RELEVANT_ACTIVITY_TYPES)
        .order('created_at', { ascending: false })
        .limit(4);

      if (error) {
        console.error('Error fetching recent activity:', error);
        throw error;
      }

      return data as ActivityLog[];
    },
  });
};