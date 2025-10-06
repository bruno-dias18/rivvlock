import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

const STORAGE_KEY = 'last_seen_admin_messages';

export const useUnreadAdminMessages = () => {
  const { user } = useAuth();
  const previousCount = useRef<number | null>(null);

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

  // Afficher une notification toast quand de nouveaux messages arrivent
  useEffect(() => {
    if (unreadCount !== undefined && unreadCount !== null) {
      if (previousCount.current !== null && unreadCount > previousCount.current) {
        const newCount = unreadCount - previousCount.current;
        toast.info(
          `${newCount} nouveau${newCount > 1 ? 'x' : ''} message${newCount > 1 ? 's' : ''} de l'administration`,
          {
            description: 'Consultez vos litiges pour plus de détails.',
            duration: 8000,
          }
        );
      }
      previousCount.current = unreadCount;
    }
  }, [unreadCount]);

  return {
    unreadCount,
    markAsSeen,
    refetch
  };
};
