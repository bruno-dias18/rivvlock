import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Manages dispute proposals (resolution offers)
 * 
 * Handles creation, acceptance, and rejection of proposals during dispute negotiation.
 * Each dispute can have multiple proposals, but only one can be accepted.
 * 
 * @param disputeId - The ID of the dispute
 * @returns Query result with proposals and mutations for proposal management
 * 
 * @example
 * ```tsx
 * const { 
 *   data: proposals, 
 *   createProposal,
 *   acceptProposal,
 *   rejectProposal 
 * } = useDisputeProposals(disputeId);
 * 
 * // Create a partial refund proposal
 * await createProposal.mutateAsync({
 *   proposalType: 'partial_refund',
 *   refundPercentage: 50,
 *   message: 'I propose 50% refund'
 * });
 * 
 * // Accept a proposal
 * await acceptProposal.mutateAsync(proposalId);
 * ```
 */
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
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      
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
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });

  const rejectProposal = useMutation({
    mutationFn: async (proposalId: string) => {
      if (!user?.id) throw new Error('User not authenticated');

      // 1) Met à jour le statut de la proposition
      const { error: updateError } = await supabase
        .from('dispute_proposals')
        .update({ 
          status: 'rejected', 
          updated_at: new Date().toISOString() 
        })
        .eq('id', proposalId);

      if (updateError) throw updateError;

      // 2) Récupère les infos minimales pour construire le texte du message
      const { data: proposal, error: propErr } = await supabase
        .from('dispute_proposals')
        .select('dispute_id, proposal_type, refund_percentage')
        .eq('id', proposalId)
        .maybeSingle();
      if (propErr) throw propErr;

      if (proposal?.dispute_id) {
        const proposalText = proposal.proposal_type === 'partial_refund'
          ? `Remboursement de ${proposal.refund_percentage}%`
          : proposal.proposal_type === 'full_refund'
          ? 'Remboursement intégral (100%)'
          : 'Aucun remboursement';

        const messageText = `❌ Proposition refusée${proposalText ? ` : ${proposalText}` : ''}`;

        // 3) Insère un message système dans la conversation de transaction
        // Récupérer la conversation de la transaction
        const { data: dispute } = await supabase
          .from('disputes')
          .select('transaction_id, transactions!inner(conversation_id)')
          .eq('id', proposal.dispute_id)
          .single();

        if (dispute?.transactions?.conversation_id) {
          await supabase
            .from('messages')
            .insert({
              conversation_id: dispute.transactions.conversation_id,
              sender_id: user.id,
              message: messageText,
              message_type: 'system',
            });
        }
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispute-proposals', disputeId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
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
