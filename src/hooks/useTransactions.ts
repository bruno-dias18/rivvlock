import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Transaction {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: 'EUR' | 'CHF';
  service_date: string;
  status: 'pending' | 'paid' | 'completed' | 'disputed';
  created_at: string;
  updated_at: string;
  user_id: string;
  buyer_id?: string;
  payment_deadline?: string;
  payment_method?: string;
  payment_blocked_at?: string;
  shared_link_token?: string;
}

export interface TransactionStats {
  totalTransactions: number;
  totalVolume: number;
  pendingTransactions: number;
  completedTransactions: number;
  paidTransactions: number;
}

export const useTransactions = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<TransactionStats>({
    totalTransactions: 0,
    totalVolume: 0,
    pendingTransactions: 0,
    completedTransactions: 0,
    paidTransactions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchTransactions = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const transactionData = data as Transaction[];
      setTransactions(transactionData);

      // Calculate stats
      const stats: TransactionStats = {
        totalTransactions: transactionData.length,
        totalVolume: transactionData.reduce((sum, t) => sum + t.price, 0),
        pendingTransactions: transactionData.filter(t => t.status === 'pending').length,
        completedTransactions: transactionData.filter(t => t.status === 'completed').length,
        paidTransactions: transactionData.filter(t => t.status === 'paid').length,
      };
      setStats(stats);

    } catch (error) {
      console.error('Error fetching transactions:', error);
      setError('Erreur lors du chargement des transactions');
    } finally {
      setLoading(false);
    }
  };

  const getPaymentCountdown = (transaction: Transaction): string | null => {
    if (!transaction.payment_deadline || transaction.status !== 'pending') return null;

    const deadline = new Date(transaction.payment_deadline);
    const now = new Date();
    
    if (now > deadline) return 'Expiré';

    const diffTime = deadline.getTime() - now.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));

    if (diffDays > 0) {
      return `Paiement dans ${diffDays}j ${diffHours}h`;
    } else if (diffHours > 0) {
      return `Paiement dans ${diffHours}h ${diffMinutes}m`;
    } else if (diffMinutes > 0) {
      return `Paiement dans ${diffMinutes}m`;
    } else {
      return 'Expire bientôt';
    }
  };

  const refreshTransactions = () => {
    fetchTransactions();
  };

  useEffect(() => {
    fetchTransactions();
  }, [user]);

  // Set up real-time subscription for transaction updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('transactions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchTransactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return {
    transactions,
    stats,
    loading,
    error,
    refreshTransactions,
    getPaymentCountdown,
  };
};