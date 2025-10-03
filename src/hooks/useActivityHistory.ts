import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ActivityLog } from './useRecentActivity';

export const useActivityHistory = (limit = 50, offset = 0) => {
  return useQuery({
    queryKey: ['activity-history', limit, offset],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .neq('activity_type', 'payment_sync')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error('Error fetching activity history:', error);
        throw error;
      }

      return data as ActivityLog[];
    },
  });
};