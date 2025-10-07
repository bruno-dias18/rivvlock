import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useAnnualTransactions = (year: number) => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['annual-transactions', user?.id, year],
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      
      const startDate = new Date(year, 0, 1).toISOString();
      const endDate = new Date(year, 11, 31, 23, 59, 59).toISOString();
      
      // Fetch all transactions
      const { data: txData, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'validated')
        .neq('refund_status', 'full')
        .gte('updated_at', startDate)
        .lte('updated_at', endDate)
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      if (!txData || txData.length === 0) {
        return {
          transactions: [],
          currencyTotals: {},
          transactionCount: 0,
          currency: 'CHF'
        };
      }
      
      // Fetch disputes and their accepted proposals for these transactions
      const transactionIds = txData.map(t => t.id);
      const { data: disputes } = await supabase
        .from('disputes')
        .select('transaction_id, resolution, dispute_proposals(refund_percentage, status, proposal_type)')
        .in('transaction_id', transactionIds);
      
      // Create map of refund percentages
      const refundMap = new Map<string, number>();
      disputes?.forEach(dispute => {
        const proposals = (dispute.dispute_proposals as any[]) || [];
        const acceptedProposal = proposals.find((p: any) => p.status === 'accepted' && (p.proposal_type === 'partial_refund' || (p.refund_percentage ?? 0) > 0));
        if (acceptedProposal?.refund_percentage) {
          refundMap.set(dispute.transaction_id, Number(acceptedProposal.refund_percentage));
          return;
        }
        // Fallback: parse percentage from resolution text like "Remboursement 30%"
        if (dispute.resolution && typeof dispute.resolution === 'string') {
          const m = dispute.resolution.match(/(\d{1,3})\s*%/);
          const pct = m ? parseInt(m[1], 10) : 0;
          if (pct > 0 && pct < 100) {
            refundMap.set(dispute.transaction_id, pct);
          }
        }
      });
      
      // Enrich transactions with refund_percentage
      const transactions = txData.map(t => ({
        ...t,
        refund_percentage: refundMap.get(t.id) || 0
      }));
      
      if (transactions.length === 0) {
        return {
          transactions: [],
          currencyTotals: {},
          transactionCount: 0,
          currency: 'CHF'
        };
      }
      
      // Grouper par devise et calculer montants réels après remboursements partiels
      const currencyTotals = transactions.reduce((acc, t) => {
        const curr = t.currency.toUpperCase();
        let amount = Number(t.price);
        // Appliquer le remboursement partiel si applicable
        if ((t.refund_status === 'partial' || (t.refund_percentage ?? 0) > 0) && t.refund_percentage) {
          amount = amount * (1 - t.refund_percentage / 100);
        }
        acc[curr] = (acc[curr] || 0) + amount;
        return acc;
      }, {} as Record<string, number>);
      
      return {
        transactions,
        currencyTotals,
        transactionCount: transactions.length,
        currency: Object.keys(currencyTotals)[0] || 'CHF' // Première devise pour compatibilité
      };
    },
    enabled: !!user?.id
  });
};
