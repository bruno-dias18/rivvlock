import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useAdminDisputes = (status?: string) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['admin-disputes', status],
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      let query = supabase
        .from('disputes')
        .select(`
          *,
          transactions (
            *,
            profiles!transactions_user_id_fkey (
              first_name,
              last_name,
              user_type
            ),
            buyer_profiles:profiles!transactions_buyer_id_fkey (
              first_name,
              last_name,
              user_type
            )
          ),
          reporter_profiles:profiles!disputes_reporter_id_fkey (
            first_name,
            last_name,
            user_type
          )
        `)
        .order('created_at', { ascending: false });

      if (status && status !== 'all') {
        query = query.eq('status', status as any);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data || [];
    },
    enabled: !!user?.id,
  });
};

export const useAdminDisputeStats = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['admin-dispute-stats'],
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('disputes')
        .select('status, created_at');

      if (error) {
        throw error;
      }

      const now = new Date();
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const stats = {
        total: data?.length || 0,
        open: data?.filter(d => d.status === 'open').length || 0,
        negotiating: data?.filter(d => d.status === 'negotiating').length || 0,
        escalated: data?.filter(d => d.status === 'escalated').length || 0,
        resolved: data?.filter(d => d.status.startsWith('resolved')).length || 0,
        recent: data?.filter(d => new Date(d.created_at) >= last30Days).length || 0,
      };

      return stats;
    },
    enabled: !!user?.id,
  });
};