import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOfflineCache } from './useOfflineCache';

export interface Transaction {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: 'EUR' | 'CHF';
  service_date: string;
  status: 'pending' | 'paid' | 'validated' | 'disputed';
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
  const { user } = useAuth();

  // Use offline cache for transactions
  const {
    data: transactionsData,
    loading,
    error,
    isOffline,
    refetch
  } = useOfflineCache<Transaction[]>(
    user ? `transactions_${user.id}` : 'transactions_guest',
    async () => {
      if (!user) return [];

      const { data, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      return data as Transaction[];
    },
    2 * 60 * 1000 // 2 minutes cache
  );

  // Ensure transactions is always an array
  const transactions: Transaction[] = Array.isArray(transactionsData) ? transactionsData : [];

  // Calculate stats from transactions
  const stats: TransactionStats = {
    totalTransactions: transactions.length,
    totalVolume: transactions.reduce((sum, t) => sum + t.price, 0),
    pendingTransactions: transactions.filter(t => t.status === 'pending').length,
          completedTransactions: transactions.filter(t => t.status === 'validated').length,
    paidTransactions: transactions.filter(t => t.status === 'paid').length,
  };

  // Real-time subscription for updates
  useEffect(() => {
    if (!user || isOffline) return;

    const channel = supabase
      .channel('transactions_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Real-time transaction update:', payload);
          refetch(); // Refetch data when changes occur
        }
      )
      .subscribe((status) => {
        console.log('Real-time subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isOffline, refetch]);

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


  return {
    transactions,
    stats,
    loading,
    error: error || (isOffline && transactions.length === 0 ? 'Mode hors ligne - données non disponibles' : null),
    isOffline,
    refreshTransactions: refetch,
    getPaymentCountdown,
  };
};