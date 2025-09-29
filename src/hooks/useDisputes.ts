import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useDisputes = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['disputes', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('disputes')
        .select(`
          *,
          transactions (
            *
          )
        `)
        .or(`reporter_id.eq.${user.id},transactions.user_id.eq.${user.id},transactions.buyer_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    },
    enabled: !!user?.id,
  });
};