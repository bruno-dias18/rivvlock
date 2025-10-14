import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Fetches the current user's profile data
 * 
 * Retrieves profile information including business details, Stripe account status,
 * and admin permissions. Uses RLS to ensure users can only access their own profile.
 * 
 * @returns {UseQueryResult<Profile>} Query result with user profile
 * 
 * @example
 * ```tsx
 * const { data: profile, isLoading } = useProfile();
 * 
 * if (isLoading) return <SkeletonLayouts.ProfileCard />;
 * 
 * return (
 *   <div>
 *     <p>{profile?.company_name}</p>
 *     <p>{profile?.business_identifier}</p>
 *   </div>
 * );
 * ```
 */
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