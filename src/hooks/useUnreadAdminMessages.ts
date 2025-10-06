import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const STORAGE_KEY = 'last_seen_admin_messages';

export const useUnreadAdminMessages = () => {
  const { user } = useAuth();

  const getLastSeenTimestamp = (): string | null => {
    return localStorage.getItem(STORAGE_KEY);
  };

  const markAsSeen = () => {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
  };

  const { data: unreadCount = 0, refetch } = useQuery({
    queryKey: ['unread-admin-messages', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;

      const lastSeen = getLastSeenTimestamp();
      
      // Compter les messages admin non lus dans les disputes de l'utilisateur
      let query = supabase
        .from('dispute_messages')
        .select('id, dispute_id, created_at', { count: 'exact', head: true })
        .or(`message_type.eq.admin_to_seller,message_type.eq.admin_to_buyer`)
        .eq('recipient_id', user.id);

      if (lastSeen) {
        query = query.gt('created_at', lastSeen);
      }

      const { count } = await query;
      return count || 0;
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Rafraîchir toutes les 30 secondes
  });

  // Toast removed - visual indicators only via badges and button colors

  return {
    unreadCount,
    markAsSeen,
    refetch
  };
};
