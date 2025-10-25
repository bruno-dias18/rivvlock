import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AdminStats {
  usersCount: number;
  transactionsCount: number;
  volumesByCurrency: Record<string, number>;
  conversionRate: number;
  usersTrend: number;
  transactionsTrend: number;
  volumeTrendsByCurrency: Record<string, number>;
  conversionTrend: number;
}

export const useAdminStats = () => {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async (): Promise<AdminStats> => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      // Récupérer le nombre total d'utilisateurs - count only, no sensitive data
      const { count: usersCount, error: usersError } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true });

      if (usersError) throw usersError;

      // Récupérer le nombre d'utilisateurs des 30 derniers jours - count only
      const { count: usersLast30Days, error: users30Error } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (users30Error) throw users30Error;

      // Récupérer le nombre d'utilisateurs entre 30 et 60 jours - count only
      const { count: usersPrevious30Days, error: usersPrevError } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', sixtyDaysAgo.toISOString())
        .lt('created_at', thirtyDaysAgo.toISOString());

      if (usersPrevError) throw usersPrevError;

      // Récupérer le nombre total de transactions
      const { count: transactionsCount, error: transError } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true });

      if (transError) throw transError;

      // Récupérer les transactions des 30 derniers jours
      const { data: transactionsLast30Days, error: trans30Error } = await supabase
        .from('transactions')
        .select('price, status, currency')
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (trans30Error) throw trans30Error;

      // Récupérer les transactions entre 30 et 60 jours
      const { data: transactionsPrevious30Days, error: transPrevError } = await supabase
        .from('transactions')
        .select('price, status, currency')
        .gte('created_at', sixtyDaysAgo.toISOString())
        .lt('created_at', thirtyDaysAgo.toISOString());

      if (transPrevError) throw transPrevError;

      // Calculer les volumes par devise
      const calculateVolumesByCurrency = (transactions: any[]) => {
        const volumes: Record<string, number> = {};
        transactions
          ?.filter(t => t.status === 'paid' || t.status === 'validated')
          ?.forEach(t => {
            const currency = t.currency || 'EUR';
            volumes[currency] = (volumes[currency] || 0) + Number(t.price || 0);
          });
        return volumes;
      };

      const volumesByCurrency = calculateVolumesByCurrency(transactionsLast30Days || []);
      const previousVolumesByCurrency = calculateVolumesByCurrency(transactionsPrevious30Days || []);

      // Calculer le taux de conversion (transactions payées / total)
      const paidTransactionsLast30 = transactionsLast30Days?.filter(t => t.status === 'paid' || t.status === 'validated').length || 0;
      const conversionRate = transactionsLast30Days?.length ? (paidTransactionsLast30 / transactionsLast30Days.length) * 100 : 0;

      const paidTransactionsPrevious30 = transactionsPrevious30Days?.filter(t => t.status === 'paid' || t.status === 'validated').length || 0;
      const previousConversionRate = transactionsPrevious30Days?.length ? (paidTransactionsPrevious30 / transactionsPrevious30Days.length) * 100 : 0;

      // Calculer les tendances par devise
      const volumeTrendsByCurrency: Record<string, number> = {};
      Object.keys(volumesByCurrency).forEach(currency => {
        const currentVolume = volumesByCurrency[currency] || 0;
        const previousVolume = previousVolumesByCurrency[currency] || 0;
        volumeTrendsByCurrency[currency] = previousVolume ? (currentVolume - previousVolume) / previousVolume * 100 : 0;
      });

      // Calculer les autres tendances
      const usersTrend = usersPrevious30Days ? ((usersLast30Days || 0) - usersPrevious30Days) / usersPrevious30Days * 100 : 0;
      const transactionsTrend = transactionsPrevious30Days?.length ? ((transactionsLast30Days?.length || 0) - transactionsPrevious30Days.length) / transactionsPrevious30Days.length * 100 : 0;
      const conversionTrend = previousConversionRate ? (conversionRate - previousConversionRate) / previousConversionRate * 100 : 0;

      return {
        usersCount: usersCount || 0,
        transactionsCount: transactionsCount || 0,
        volumesByCurrency,
        conversionRate,
        usersTrend,
        transactionsTrend,
        volumeTrendsByCurrency,
        conversionTrend,
      };
    },
    refetchInterval: 60000, // Réduit à 60s
  });
};