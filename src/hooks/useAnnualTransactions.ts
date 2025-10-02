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
          totalRevenue: 0,
          transactionCount: 0,
          averageTransaction: 0,
          currency: 'CHF'
        };
      }
      
      const totalRevenue = transactions.reduce((sum, t) => sum + Number(t.price), 0);
      const currency = transactions[0]?.currency || 'CHF';
      
      return {
        transactions,
        totalRevenue,
        transactionCount: transactions.length,
        averageTransaction: totalRevenue / transactions.length,
        currency: currency.toUpperCase()
      };
    },
    enabled: !!user?.id
  });
};
