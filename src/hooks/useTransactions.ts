import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOfflineCache } from './useOfflineCache';

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
  payment_blocked_at?: string;
  shared_link_token?: string;
  buyer_profile?: BuyerProfile;
  seller_profile?: BuyerProfile;
  user_role: 'seller' | 'buyer';
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

      // Step 1: Fetch transactions where user is seller OR buyer
      const { data: transactionsData, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .or(`user_id.eq.${user.id},buyer_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      if (!transactionsData) return [];

      // Step 2: Get unique counterparty IDs (buyers and sellers)
      const buyerIds = transactionsData
        .filter(t => t.user_id === user.id && t.buyer_id) // When user is seller
        .map(t => t.buyer_id)
        .filter((id): id is string => id !== null && id !== undefined);

      const sellerIds = transactionsData
        .filter(t => t.buyer_id === user.id) // When user is buyer
        .map(t => t.user_id)
        .filter((id): id is string => id !== null && id !== undefined);

      const allCounterpartyIds = [...new Set([...buyerIds, ...sellerIds])];

      let counterpartyProfiles: BuyerProfile[] = [];
      
      // Step 3: Fetch counterparty profiles
      if (allCounterpartyIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, company_name')
          .in('user_id', allCounterpartyIds);

        if (!profilesError && profilesData) {
          counterpartyProfiles = profilesData;
        }
      }

      // Step 4: Combine data client-side
      const processedData = transactionsData.map(transaction => {
        const isUserSeller = transaction.user_id === user.id;
        const isUserBuyer = transaction.buyer_id === user.id;
        
        return {
          ...transaction,
          user_role: isUserSeller ? 'seller' as const : 'buyer' as const,
          buyer_profile: isUserSeller && transaction.buyer_id 
            ? counterpartyProfiles.find(profile => profile.user_id === transaction.buyer_id) || null
            : null,
          seller_profile: isUserBuyer 
            ? counterpartyProfiles.find(profile => profile.user_id === transaction.user_id) || null
            : null
        };
      });
      
      return processedData as Transaction[];
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
          console.log('Real-time transaction update (seller):', payload);
          refetch(); // Refetch data when changes occur
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `buyer_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Real-time transaction update (buyer):', payload);
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

  const getCounterpartyDisplayName = (transaction: Transaction): string => {
    if (transaction.user_role === 'seller') {
      // User is seller, show buyer info
      if (!transaction.buyer_id) {
        return 'En attente d\'acheteur';
      }

      const profile = transaction.buyer_profile;
      if (!profile) {
        return 'Acheteur';
      }

      if (profile.company_name) {
        return profile.company_name;
      }

      if (profile.first_name || profile.last_name) {
        return `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
      }

      return 'Acheteur';
    } else {
      // User is buyer, show seller info
      const profile = transaction.seller_profile;
      if (!profile) {
        return 'Vendeur';
      }

      if (profile.company_name) {
        return profile.company_name;
      }

      if (profile.first_name || profile.last_name) {
        return `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
      }

      return 'Vendeur';
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


  return {
    transactions,
    stats,
    loading,
    error: error || (isOffline && transactions.length === 0 ? 'Mode hors ligne - données non disponibles' : null),
    isOffline,
    refreshTransactions: refetch,
    getPaymentCountdown,
    getCounterpartyDisplayName,
  };
};