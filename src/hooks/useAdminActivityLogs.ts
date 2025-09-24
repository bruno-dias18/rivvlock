import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ActivityLog } from './useRecentActivity';

export const useAdminActivityLogs = (limit = 20) => {
  return useQuery({
    queryKey: ['admin-activity-logs', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .neq('activity_type', 'payment_sync')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching admin activity logs:', error);
        throw error;
      }

      return data as ActivityLog[];
    },
    refetchInterval: 15000,
  });
};