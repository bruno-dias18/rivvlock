import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

// Global realtime notifications for dispute events (proposals, refusals)
export const useDisputeRealtimeNotifications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`disputes-realtime-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dispute_messages' },
        async (payload) => {
          const msg: any = payload.new;
          if (!msg) return;
          // Ignore own messages
          if (msg.sender_id === user.id) return;

          // Only notify for relevant dispute events
          const type = msg.message_type as string | undefined;
          const text = (msg.message as string) || '';

          let title: string | null = null;
          let description: string | undefined;

          if (type === 'proposal') {
            title = 'Nouvelle proposition officielle';
            description = text.length > 120 ? text.slice(0, 117) + '…' : text;
          } else if (type === 'system' && (text.includes('Proposition refusée') || text.startsWith('❌'))) {
            title = 'Proposition refusée';
            description = text;
          }

          if (title) {
            try {
              // Try to fetch the transaction title for richer context
              const { data: dispute } = await supabase
                .from('disputes')
                .select('transaction_id')
                .eq('id', msg.dispute_id)
                .single();

              let txTitle: string | undefined;
              if (dispute?.transaction_id) {
                const { data: tx } = await supabase
                  .from('transactions')
                  .select('title')
                  .eq('id', dispute.transaction_id)
                  .single();
                txTitle = tx?.title as string | undefined;
              }

              toast(title, {
                description: txTitle ? `${txTitle} • ${description || ''}` : description,
                duration: 5000,
              });

              // Refresh cached counts and message lists
              queryClient.invalidateQueries({ queryKey: ['new-items-notifications', user.id] });
              queryClient.invalidateQueries({ queryKey: ['dispute-messages'] });
            } catch {
              toast(title, { description, duration: 5000 });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
};
