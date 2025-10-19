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
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const msg: any = payload.new;
          if (!msg) return;
          // Ignore own messages
          if (msg.sender_id === user.id) return;

          // Check if this message belongs to a dispute conversation
          if (!msg.conversation_id) return;

          const { data: conversation } = await supabase
            .from('conversations')
            .select('dispute_id, transaction_id')
            .eq('id', msg.conversation_id)
            .maybeSingle();

          // Only process if it's a dispute conversation
          if (!conversation?.dispute_id) return;

          // Only notify for relevant dispute events
          const type = msg.message_type as string | undefined;
          const raw = msg.message;
          const text = typeof raw === 'string' ? raw : (raw == null ? '' : (() => {
            try { return JSON.stringify(raw); } catch { return String(raw); }
          })());

          let title: string | null = null;
          let description: string | undefined;

          if (type === 'proposal') {
            title = 'Nouvelle proposition officielle';
            const safe = typeof text === 'string' ? text : String(text ?? '');
            description = safe.length > 120 ? safe.slice(0, 117) + '…' : safe;
          } else if (type === 'system' && typeof text === 'string' && (text.includes('Proposition refusée') || text.startsWith('❌'))) {
            title = 'Proposition refusée';
            description = text;
          }

          if (title) {
            try {
              // Try to fetch the transaction title for richer context
              let txTitle: string | undefined;
              if (conversation.transaction_id) {
                const { data: tx } = await supabase
                  .from('transactions')
                  .select('title')
                  .eq('id', conversation.transaction_id)
                  .single();
                txTitle = tx?.title as string | undefined;
              }

              toast(title, {
                description: txTitle ? `${txTitle} • ${description || ''}` : description,
                duration: 5000,
              });

              // Refresh cached counts and message lists
              queryClient.invalidateQueries({ queryKey: ['new-items-notifications', user.id] });
              queryClient.refetchQueries({ queryKey: ['unread-conversation-messages'], type: 'all' });
              queryClient.invalidateQueries({ queryKey: ['unread-disputes-global'] });
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
