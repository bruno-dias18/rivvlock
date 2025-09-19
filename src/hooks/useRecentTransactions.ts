import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface RecentTransaction {
  id: string;
  title: string;
  price: number;
  currency: string;
  status: string;
  service_date: string | null;
  created_at: string;
  profiles?: {
    first_name?: string;
    last_name?: string;
    company_name?: string;
  } | null;
}

export const useRecentTransactions = (isAdminView: boolean = false) => {
  const [transactions, setTransactions] = useState<RecentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecentTransactions = async () => {
    try {
      setLoading(true);
      
      // Base query - same for both admin and regular users since RLS handles access
      const { data, error: queryError } = await supabase
        .from('transactions')
        .select(`
          id,
          title,
          price,
          currency,
          status,
          service_date,
          created_at,
          user_id
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (queryError) throw queryError;
      
      // Get user profiles for these transactions
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(t => t.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, company_name')
          .in('user_id', userIds);
        
        // Merge profiles with transactions
        const transactionsWithProfiles = data.map(transaction => ({
          ...transaction,
          profiles: profiles?.find(p => p.user_id === transaction.user_id) || null
        }));
        
        setTransactions(transactionsWithProfiles);
      } else {
        setTransactions([]);
      }
      
      setError(null);
    } catch (err) {
      console.error('Error fetching recent transactions:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentTransactions();

    // Set up real-time subscription
    const channel = supabase
      .channel('admin_transactions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions'
        },
        (payload) => {
          console.log('Transaction change detected:', payload);
          fetchRecentTransactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getDisplayName = (transaction: RecentTransaction) => {
    if (transaction.profiles?.company_name) {
      return transaction.profiles.company_name;
    }
    
    if (transaction.profiles?.first_name && transaction.profiles?.last_name) {
      return `${transaction.profiles.first_name} ${transaction.profiles.last_name}`;
    }
    
    return 'Utilisateur';
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default' as const;
      case 'disputed':
        return 'destructive' as const;
      case 'paid':
        return 'secondary' as const;
      default:
        return 'outline' as const;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'En attente';
      case 'paid':
        return 'Payé';
      case 'completed':
        return 'Complété';
      case 'disputed':
        return 'Litige';
      default:
        return status;
    }
  };

  const getActivityAction = (transaction: RecentTransaction) => {
    switch (transaction.status) {
      case 'pending':
        return 'Transaction créée';
      case 'paid':
        return 'Paiement effectué';
      case 'completed':
        return 'Transaction validée';
      case 'disputed':
        return 'Litige ouvert';
      default:
        return 'Transaction mise à jour';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'À l\'instant';
    if (diffInMinutes < 60) return `${diffInMinutes} min`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
    return `${Math.floor(diffInMinutes / 1440)}j`;
  };

  return {
    transactions,
    loading,
    error,
    getDisplayName,
    getStatusBadgeVariant,
    getStatusLabel,
    getActivityAction,
    formatTimeAgo,
    refreshTransactions: fetchRecentTransactions
  };
};