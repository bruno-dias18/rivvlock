import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface BuyerProfile {
  first_name?: string;
  last_name?: string;
  company_name?: string;
  user_id?: string;
}

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
  shared_link_token?: string;
  seller_display_name?: string | null;
  buyer_display_name?: string | null;
  buyer_profile?: BuyerProfile;
  seller_profile?: BuyerProfile;
  user_role: 'seller' | 'buyer';
  stripe_payment_intent_id?: string;
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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = async () => {
    if (!user) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          buyer_profile:profiles!transactions_buyer_id_fkey(
            first_name,
            last_name,
            company_name,
            user_id
          ),
          seller_profile:profiles!transactions_user_id_fkey(
            first_name,
            last_name,
            company_name,
            user_id
          )
        `)
        .or(`user_id.eq.${user.id},buyer_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Process transactions to add user role and counterparty
      const processedTransactions = (data || []).map((transaction: any) => {
        const userRole = transaction.user_id === user.id ? 'seller' : 'buyer';
        
        return {
          ...transaction,
          user_role: userRole
        };
      });

      setTransactions(processedTransactions);
      setError(null);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [user]);

  // Calculate stats from transactions
  const stats: TransactionStats = {
    totalTransactions: transactions.length,
    totalVolume: transactions.reduce((sum, t) => sum + t.price, 0),
    pendingTransactions: transactions.filter(t => t.status === 'pending').length,
    completedTransactions: transactions.filter(t => t.status === 'validated').length,
    paidTransactions: transactions.filter(t => t.status === 'paid').length,
  };

  // Real-time subscription for changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('transactions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchTransactions();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `buyer_id=eq.${user.id}`
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
    refetch: fetchTransactions,
    getPaymentCountdown: (transaction: Transaction): string | null => {
      if (!transaction.payment_deadline || transaction.status !== 'pending') {
        return null;
      }

      const deadline = new Date(transaction.payment_deadline);
      const now = new Date();
      const diffInMs = deadline.getTime() - now.getTime();
      
      if (diffInMs <= 0) {
        return 'Expiré';
      }

      const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
      const diffInDays = Math.floor(diffInHours / 24);

      if (diffInDays > 0) {
        return `${diffInDays} jour${diffInDays > 1 ? 's' : ''}`;
      } else {
        return `${diffInHours} heure${diffInHours > 1 ? 's' : ''}`;
      }
    },
    getCounterpartyDisplayName: (transaction: Transaction): string => {
      if (transaction.user_role === 'seller') {
        // User is seller, show buyer name
        return transaction.buyer_display_name || 
               transaction.buyer_profile?.company_name ||
               `${transaction.buyer_profile?.first_name || ''} ${transaction.buyer_profile?.last_name || ''}`.trim() ||
               'Acheteur';
      } else {
        // User is buyer, show seller name  
        return transaction.seller_display_name ||
               transaction.seller_profile?.company_name ||
               `${transaction.seller_profile?.first_name || ''} ${transaction.seller_profile?.last_name || ''}`.trim() ||
               'Vendeur';
      }
    }
  };
};