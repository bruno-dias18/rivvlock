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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispute-proposals', disputeId] });
      queryClient.invalidateQueries({ queryKey: ['dispute-messages', disputeId] });
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

        // Get proposal info to create message
        const { data: proposal } = await supabase
          .from('dispute_proposals')
          .select('dispute_id, proposal_type, refund_percentage')
          .eq('id', proposalId)
          .single();

        if (proposal) {
          const proposalText = proposal.proposal_type === 'partial_refund'
            ? `Remboursement de ${proposal.refund_percentage}%`
            : proposal.proposal_type === 'full_refund'
            ? 'Remboursement intégral (100%)'
            : 'Aucun remboursement';

          // Add rejection message visible to all participants
          await supabase
            .from('dispute_messages')
            .insert({
              dispute_id: proposal.dispute_id,
              sender_id: user?.id,
              recipient_id: null, // Message public visible par tous les participants
              message: `❌ Proposition refusée : ${proposalText}`,
              message_type: 'system',
            });
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
