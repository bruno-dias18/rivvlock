import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, subDays, format } from 'date-fns';

export type AnalyticsPeriod = '7d' | '30d' | '90d' | 'custom';

interface TimeSeriesData {
  date: string;
  transactions: number;
  users: number;
  volume: number;
}

interface StatusDistribution {
  status: string;
  count: number;
  percentage: number;
}

interface CurrencyVolume {
  currency: string;
  volume: number;
  count: number;
}

interface AnalyticsData {
  timeSeries: TimeSeriesData[];
  statusDistribution: StatusDistribution[];
  currencyVolumes: CurrencyVolume[];
  totalTransactions: number;
  totalVolume: number;
  totalUsers: number;
}

const getPeriodDays = (period: AnalyticsPeriod): number => {
  switch (period) {
    case '7d': return 7;
    case '30d': return 30;
    case '90d': return 90;
    default: return 30;
  }
};

export const useAdminAnalytics = (period: AnalyticsPeriod = '30d', customStartDate?: Date, customEndDate?: Date) => {
  return useQuery({
    queryKey: ['admin-analytics', period, customStartDate, customEndDate],
    queryFn: async (): Promise<AnalyticsData> => {
      const endDate = customEndDate || new Date();
      const startDate = customStartDate || subDays(endDate, getPeriodDays(period));

      // Fetch transactions with specific columns only
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('id, created_at, price, currency, status')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      if (txError) throw txError;

      // Fetch users - only basic, non-sensitive fields for analytics
      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('id, created_at, user_type, country')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      if (usersError) throw usersError;

      // Build time series data
      const daysInPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const timeSeriesMap = new Map<string, TimeSeriesData>();

      // Initialize all days
      for (let i = 0; i <= daysInPeriod; i++) {
        const date = format(subDays(endDate, daysInPeriod - i), 'yyyy-MM-dd');
        timeSeriesMap.set(date, {
          date,
          transactions: 0,
          users: 0,
          volume: 0,
        });
      }

      // Aggregate transactions by day
      transactions?.forEach((tx) => {
        const date = format(new Date(tx.created_at), 'yyyy-MM-dd');
        const data = timeSeriesMap.get(date);
        if (data) {
          data.transactions += 1;
          data.volume += Number(tx.price);
        }
      });

      // Aggregate users by day
      users?.forEach((user) => {
        const date = format(new Date(user.created_at), 'yyyy-MM-dd');
        const data = timeSeriesMap.get(date);
        if (data) {
          data.users += 1;
        }
      });

      // Calculate status distribution
      const statusMap = new Map<string, number>();
      const totalTx = transactions?.length || 0;
      
      transactions?.forEach((tx) => {
        statusMap.set(tx.status, (statusMap.get(tx.status) || 0) + 1);
      });

      const statusDistribution: StatusDistribution[] = Array.from(statusMap.entries()).map(
        ([status, count]) => ({
          status,
          count,
          percentage: totalTx > 0 ? (count / totalTx) * 100 : 0,
        })
      );

      // Calculate currency volumes
      const currencyMap = new Map<string, { volume: number; count: number }>();
      
      transactions?.forEach((tx) => {
        const current = currencyMap.get(tx.currency) || { volume: 0, count: 0 };
        current.volume += Number(tx.price);
        current.count += 1;
        currencyMap.set(tx.currency, current);
      });

      const currencyVolumes: CurrencyVolume[] = Array.from(currencyMap.entries()).map(
        ([currency, data]) => ({
          currency: currency.toUpperCase(),
          volume: data.volume,
          count: data.count,
        })
      );

      // Calculate totals
      const totalVolume = transactions?.reduce((sum, tx) => sum + Number(tx.price), 0) || 0;

      return {
        timeSeries: Array.from(timeSeriesMap.values()),
        statusDistribution,
        currencyVolumes,
        totalTransactions: totalTx,
        totalVolume,
        totalUsers: users?.length || 0,
      };
    },
    staleTime: 60000, // 1 minute - data stays fresh
    gcTime: 300000, // 5 minutes - keep in cache
    refetchInterval: period === '7d' ? 30000 : 60000, // More frequent refresh for shorter periods
  });
};
