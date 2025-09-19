import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Participant {
  user_id: string;
  profile: {
    user_id: string;
    first_name?: string;
    last_name?: string;
    company_name?: string;
    user_type: 'individual' | 'company' | 'independent';
  };
  relationship: 'buyer' | 'seller';
  transactions_count: number;
  total_amount: number;
  last_transaction_date: string;
  transactions: Array<{
    id: string;
    title: string;
    price: number;
    currency: string;
    status: string;
    created_at: string;
  }>;
}

export const useParticipants = () => {
  const { user } = useAuth();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchParticipants = async () => {
      if (!user) return;

      try {
        setLoading(true);

        // Fetch transactions where user is seller (user_id = current user)
        const { data: sellerTransactions, error: sellerError } = await supabase
          .from('transactions')
          .select(`
            id,
            title,
            price,
            currency,
            status,
            created_at,
            buyer_id,
            profiles!transactions_buyer_id_fkey (
              user_id,
              first_name,
              last_name,
              company_name,
              user_type
            )
          `)
          .eq('user_id', user.id)
          .not('buyer_id', 'is', null);

        if (sellerError) throw sellerError;

        // Fetch transactions where user is buyer (buyer_id = current user)
        const { data: buyerTransactions, error: buyerError } = await supabase
          .from('transactions')
          .select(`
            id,
            title,
            price,
            currency,
            status,
            created_at,
            user_id,
            profiles!transactions_user_id_fkey (
              user_id,
              first_name,
              last_name,
              company_name,
              user_type
            )
          `)
          .eq('buyer_id', user.id);

        if (buyerError) throw buyerError;

        // Process and group participants
        const participantsMap = new Map<string, Participant>();

        // Process seller transactions (user is seller, others are buyers)
        sellerTransactions?.forEach((transaction: any) => {
          if (transaction.profiles) {
            const partnerId = transaction.buyer_id;
            if (!participantsMap.has(partnerId)) {
              participantsMap.set(partnerId, {
                user_id: partnerId,
                profile: transaction.profiles,
                relationship: 'buyer',
                transactions_count: 0,
                total_amount: 0,
                last_transaction_date: '',
                transactions: []
              });
            }

            const participant = participantsMap.get(partnerId)!;
            participant.transactions_count++;
            participant.total_amount += transaction.price;
            participant.transactions.push({
              id: transaction.id,
              title: transaction.title,
              price: transaction.price,
              currency: transaction.currency,
              status: transaction.status,
              created_at: transaction.created_at
            });

            if (transaction.created_at > participant.last_transaction_date) {
              participant.last_transaction_date = transaction.created_at;
            }
          }
        });

        // Process buyer transactions (user is buyer, others are sellers)
        buyerTransactions?.forEach((transaction: any) => {
          if (transaction.profiles) {
            const partnerId = transaction.user_id;
            if (!participantsMap.has(partnerId)) {
              participantsMap.set(partnerId, {
                user_id: partnerId,
                profile: transaction.profiles,
                relationship: 'seller',
                transactions_count: 0,
                total_amount: 0,
                last_transaction_date: '',
                transactions: []
              });
            }

            const participant = participantsMap.get(partnerId)!;
            participant.transactions_count++;
            participant.total_amount += transaction.price;
            participant.transactions.push({
              id: transaction.id,
              title: transaction.title,
              price: transaction.price,
              currency: transaction.currency,
              status: transaction.status,
              created_at: transaction.created_at
            });

            if (transaction.created_at > participant.last_transaction_date) {
              participant.last_transaction_date = transaction.created_at;
            }
          }
        });

        setParticipants(Array.from(participantsMap.values()));
      } catch (error) {
        console.error('Error fetching participants:', error);
        setError('Impossible de charger les participants');
      } finally {
        setLoading(false);
      }
    };

    fetchParticipants();
  }, [user]);

  const getDisplayName = (profile: Participant['profile']): string => {
    if (profile.user_type === 'company' && profile.company_name) {
      return profile.company_name;
    }
    
    if (profile.first_name || profile.last_name) {
      return `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
    }
    
    return 'Utilisateur';
  };

  const getBuyers = () => participants.filter(p => p.relationship === 'buyer');
  const getSellers = () => participants.filter(p => p.relationship === 'seller');

  return {
    participants,
    buyers: getBuyers(),
    sellers: getSellers(),
    loading,
    error,
    getDisplayName
  };
};