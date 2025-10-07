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
      // Use edge function to ensure atomic update + system message + notifications
      const { data, error } = await supabase.functions.invoke('reject-proposal', {
        body: { proposalId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      // Refresh lists so the new system message appears immediately
      queryClient.invalidateQueries({ queryKey: ['dispute-proposals', disputeId] });
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dispute-messages', disputeId] });

      // Local feedback for the rejecting user
      try {
        const { toast } = await import('sonner');
        toast.success('Proposition refusée', {
          description: "Votre refus a été envoyé et notifié à l'autre partie",
          duration: 4000,
        });
      } catch {}
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
