import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useProfile = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      
      // For user's own profile, we need full access. Use direct query with full permissions.
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      const profileData = data;
      
      if (error) {
        throw error;
      }
      
      return profileData;
    },
    enabled: !!user?.id,
  });
};