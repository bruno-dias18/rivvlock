import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AdminUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  user_type: string;
  country: string;
  verified: boolean;
  created_at: string;
}

export const useAdminUsers = (limit = 10) => {
  return useQuery({
    queryKey: ['admin-users', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, first_name, last_name, user_type, country, verified, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching admin users:', error);
        throw error;
      }

      return data as AdminUser[];
    },
    refetchInterval: 30000,
  });
};