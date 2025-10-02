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
      
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'validated')
        .gte('updated_at', startDate)
        .lte('updated_at', endDate)
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      
      const transactions = data || [];
      
      if (transactions.length === 0) {
        return {
          transactions: [],
          currencyTotals: {},
          transactionCount: 0,
          currency: 'CHF'
        };
      }
      
      // Grouper par devise
      const currencyTotals = transactions.reduce((acc, t) => {
        const curr = t.currency.toUpperCase();
        acc[curr] = (acc[curr] || 0) + Number(t.price);
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
