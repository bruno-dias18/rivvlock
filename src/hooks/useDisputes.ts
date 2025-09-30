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

      // Fetch disputes - RLS policies will handle filtering
      const { data, error } = await supabase
        .from('disputes')
        .select(`
          *,
          transactions (
            *
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    },
    enabled: !!user?.id,
  });
};