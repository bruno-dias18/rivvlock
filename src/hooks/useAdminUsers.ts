import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface AdminUser {
  id: string;
  user_id: string;
  user_type: string;
  country: string;
  verified: boolean;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
}

export const useAdminUsers = (limit = 10) => {
  return useQuery({
    queryKey: ['admin-users', limit],
    queryFn: async () => {
      // Use secure profile access with minimal data only
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, user_type, country, verified, created_at, first_name, last_name, company_name')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Error fetching admin users:', error);
        throw error;
      }

      return data as AdminUser[];
    },
    refetchInterval: 90000, // 90s avec realtime prioritaire
  });
};