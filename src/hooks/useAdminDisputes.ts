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
          transactions!inner(
            id,
            title,
            price,
            currency,
            service_date,
            status,
            seller_display_name,
            buyer_display_name,
            user_id,
            buyer_id
          ),
          reporter_profiles:profiles!disputes_reporter_id_fkey(
            first_name,
            last_name,
            user_type
          )
        `)
        .order('created_at', { ascending: false });

      if (status && status !== 'all') {
        if (status === 'resolved') {
          // Filter all resolved statuses
          query = query.in('status', ['resolved', 'resolved_refund', 'resolved_release']);
        } else if (status === 'recent') {
          // Filter disputes from last 30 days
          const now = new Date();
          const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          query = query.gte('created_at', last30Days.toISOString());
        } else {
          query = query.eq('status', status as any);
        }
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