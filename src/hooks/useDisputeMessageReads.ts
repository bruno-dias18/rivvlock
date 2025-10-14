import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';

/**
 * Hook to manage dispute message read status in the database
 * This replaces localStorage for cross-device synchronization
 */
export const useDisputeMessageReads = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const markDisputeAsSeen = useMutation({
    mutationFn: async (disputeId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Upsert read status (insert or update if exists)
      const { error } = await supabase
        .from('dispute_message_reads')
        .upsert(
          {
            user_id: user.id,
            dispute_id: disputeId,
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id,dispute_id',
          }
        );

      if (error) {
        console.error('Error marking dispute as seen:', error);
        throw error;
      }

      return { disputeId, userId: user.id };
    },
    onSuccess: (data) => {
      // Invalidate all notification-related queries to refresh badges
      queryClient.invalidateQueries({ queryKey: ['unread-dispute-messages', data.disputeId] });
      queryClient.invalidateQueries({ queryKey: ['unread-disputes-global'] });
      queryClient.invalidateQueries({ queryKey: ['unread-admin-messages'] });
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
      
      console.log('✅ Dispute marked as seen in DB:', data.disputeId);
    },
    onError: (error) => {
      console.error('❌ Failed to mark dispute as seen:', error);
      // Silent error - no need to show toast for background operation
    },
  });

  return {
    markDisputeAsSeen: markDisputeAsSeen.mutate,
    isMarking: markDisputeAsSeen.isPending,
  };
};
