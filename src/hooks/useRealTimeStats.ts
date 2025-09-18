import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface RealTimeStats {
  totalTransactions: number;
  totalVolume: number;
  totalFees: number;
  pendingTransactions: number;
  completedTransactions: number;
  disputedTransactions: number;
  paidTransactions: number;
  conversionRate: number;
  monthlyVolume: number;
  monthlyTransactions: number;
  loading: boolean;
  error: string | null;
}

export const useRealTimeStats = () => {
  const [stats, setStats] = useState<RealTimeStats>({
    totalTransactions: 0,
    totalVolume: 0,
    totalFees: 0,
    pendingTransactions: 0,
    completedTransactions: 0,
    disputedTransactions: 0,
    paidTransactions: 0,
    conversionRate: 0,
    monthlyVolume: 0,
    monthlyTransactions: 0,
    loading: true,
    error: null,
  });

  const fetchStats = async () => {
    try {
      setStats(prev => ({ ...prev, loading: true, error: null }));

      // Get all transactions
      const { data: transactions, error: transactionsError } = await supabase
        .from('transactions')
        .select('*');

      if (transactionsError) throw transactionsError;

      // Get current month start
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Calculate stats
      const totalTransactions = transactions?.length || 0;
      const totalVolume = transactions?.reduce((sum, t) => sum + Number(t.price), 0) || 0;
      const totalFees = totalVolume * 0.05; // 5% platform fee
      
      const pendingTransactions = transactions?.filter(t => t.status === 'pending').length || 0;
      const paidTransactions = transactions?.filter(t => t.status === 'paid').length || 0;
      const completedTransactions = transactions?.filter(t => t.status === 'completed').length || 0;
      
      // Get disputes count
      const { data: disputes, error: disputesError } = await supabase
        .from('disputes')
        .select('id');
      
      if (disputesError) console.error('Error fetching disputes:', disputesError);
      const disputedTransactions = disputes?.length || 0;

      // Calculate conversion rate (completed / total non-pending)
      const nonPendingTransactions = totalTransactions - pendingTransactions;
      const conversionRate = nonPendingTransactions > 0 
        ? (completedTransactions / nonPendingTransactions) * 100 
        : 0;

      // Monthly stats
      const monthlyTxs = transactions?.filter(t => 
        new Date(t.created_at) >= monthStart
      ) || [];
      const monthlyVolume = monthlyTxs.reduce((sum, t) => sum + Number(t.price), 0);
      const monthlyTransactions = monthlyTxs.length;

      setStats({
        totalTransactions,
        totalVolume,
        totalFees,
        pendingTransactions,
        completedTransactions,
        disputedTransactions,
        paidTransactions,
        conversionRate,
        monthlyVolume,
        monthlyTransactions,
        loading: false,
        error: null,
      });

    } catch (error) {
      console.error('Error fetching real-time stats:', error);
      setStats(prev => ({
        ...prev,
        loading: false,
        error: 'Erreur lors du chargement des statistiques',
      }));
    }
  };

  useEffect(() => {
    fetchStats();

    // Set up real-time subscription for transactions
    const transactionsChannel = supabase
      .channel('admin_stats_transactions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
        },
        () => {
          console.log('Transaction change detected, refreshing stats...');
          fetchStats();
        }
      )
      .subscribe();

    // Set up real-time subscription for disputes
    const disputesChannel = supabase
      .channel('admin_stats_disputes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'disputes',
        },
        () => {
          console.log('Dispute change detected, refreshing stats...');
          fetchStats();
        }
      )
      .subscribe();

    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);

    return () => {
      supabase.removeChannel(transactionsChannel);
      supabase.removeChannel(disputesChannel);
      clearInterval(interval);
    };
  }, []);

  return { stats, refreshStats: fetchStats };
};