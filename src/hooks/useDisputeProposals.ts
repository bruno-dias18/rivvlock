import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useDisputeProposals = (disputeId: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: proposals = [], isLoading } = useQuery({
    queryKey: ['dispute-proposals', disputeId],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('dispute_proposals')
        .select('*')
        .eq('dispute_id', disputeId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && !!disputeId,
  });

  const createProposal = useMutation({
    mutationFn: async ({ 
      proposalType, 
      refundPercentage, 
      message 
    }: { 
      proposalType: string; 
      refundPercentage?: number; 
      message?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('create-proposal', {
        body: {
          disputeId,
          proposalType,
          refundPercentage,
          message,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dispute-proposals', disputeId] });
      queryClient.invalidateQueries({ queryKey: ['dispute-messages', disputeId] });
      
      // 🔥 NOTIFICATION IMMÉDIATE pour nouvelle proposition
      const proposalText = data?.proposal?.proposal_type === 'partial_refund'
        ? `Remboursement de ${data.proposal.refund_percentage}%`
        : data?.proposal?.proposal_type === 'full_refund'
        ? 'Remboursement intégral (100%)'
        : 'Aucun remboursement';
      
      // Toast de succès avec détails
      import('sonner').then(({ toast }) => {
        toast.success(`🎯 Proposition envoyée : ${proposalText}`, {
          description: 'L\'autre partie va recevoir une notification',
          duration: 4000,
        });
      });
    },
  });

  const acceptProposal = useMutation({
    mutationFn: async (proposalId: string) => {
      const { data, error } = await supabase.functions.invoke('accept-proposal', {
        body: { proposalId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispute-proposals', disputeId] });
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dispute-messages', disputeId] });
    },
  });

  const rejectProposal = useMutation({
    mutationFn: async (proposalId: string) => {
      try {
        // Direct database update since edge function has issues
        const { error } = await supabase
          .from('dispute_proposals')
          .update({ 
            status: 'rejected', 
            updated_at: new Date().toISOString() 
          })
          .eq('id', proposalId);

        if (error) throw error;

        // Get proposal and dispute info to create message and notifications
        const { data: proposal } = await supabase
          .from('dispute_proposals')
          .select(`
            dispute_id, 
            proposal_type, 
            refund_percentage,
            proposer_id
          `)
          .eq('id', proposalId)
          .single();

        // Get dispute and transaction info separately
        const { data: dispute } = await supabase
          .from('disputes')
          .select(`
            transaction_id,
            transactions (
              id,
              title,
              user_id,
              buyer_id
            )
          `)
          .eq('id', proposal?.dispute_id)
          .single();

        if (proposal && dispute) {
          const proposalText = proposal.proposal_type === 'partial_refund'
            ? `Remboursement de ${proposal.refund_percentage}%`
            : proposal.proposal_type === 'full_refund'
            ? 'Remboursement intégral (100%)'
            : 'Aucun remboursement';

          const transaction = dispute.transactions as any;

          // Add rejection message visible to ALL participants
          await supabase
            .from('dispute_messages')
            .insert({
              dispute_id: proposal.dispute_id,
              sender_id: user?.id,
              recipient_id: null, // Message public visible par TOUS
              message: `❌ Proposition refusée : ${proposalText}`,
              message_type: 'system',
            });

          // NOTIFICATIONS pour tous les autres participants
          const allParticipants = [transaction?.user_id, transaction?.buyer_id].filter(id => id && id !== user?.id);
          
          // Log activity pour tous les participants
          for (const participantId of allParticipants) {
            await supabase.from('activity_logs').insert({
              user_id: participantId,
              activity_type: 'dispute_proposal_rejected',
              title: `Proposition refusée - "${transaction?.title}"`,
              description: `La proposition "${proposalText}" a été refusée`,
              metadata: {
                dispute_id: proposal.dispute_id,
                transaction_id: transaction?.id,
                proposal_id: proposalId,
              }
            });
          }

          // Envoyer notifications push
          try {
            await supabase.functions.invoke('send-notifications', {
              body: {
                type: 'dispute_proposal_rejected',
                transactionId: transaction?.id,
                message: `🚫 Proposition refusée concernant "${transaction?.title}" : ${proposalText}`,
                recipients: allParticipants
              }
            });
          } catch (notificationError) {
            console.error('Error sending notifications:', notificationError);
          }
        }

        return { success: true };
      } catch (error) {
        console.error('Error rejecting proposal:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispute-proposals', disputeId] });
      queryClient.invalidateQueries({ queryKey: ['dispute-messages', disputeId] });
    },
  });

  // Separate admin and user proposals
  const adminProposals = proposals.filter(p => p.admin_created);
  const userProposals = proposals.filter(p => !p.admin_created);

  return {
    proposals,
    adminProposals,
    userProposals,
    isLoading,
    createProposal: createProposal.mutateAsync,
    acceptProposal: acceptProposal.mutateAsync,
    rejectProposal: rejectProposal.mutateAsync,
    isCreating: createProposal.isPending,
    isAccepting: acceptProposal.isPending,
    isRejecting: rejectProposal.isPending,
  };
};
