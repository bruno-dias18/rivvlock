import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Download, Users, DollarSign, Activity } from 'lucide-react';
import { type AnalyticsPeriod } from '@/hooks/useAdminAnalytics';
import { Skeleton } from '@/components/ui/skeleton';

interface AdminAnalyticsKPIsProps {
  period: AnalyticsPeriod;
  onPeriodChange: (period: AnalyticsPeriod) => void;
  analytics: {
    totalTransactions: number;
    totalVolume: number;
    totalUsers: number;
    currencyVolumes: Array<{ currency: string; volume: number; count: number }>;
    timeSeries: Array<{ date: string; transactions: number; users: number; volume: number }>;
  } | undefined;
  isLoading: boolean;
}

export const AdminAnalyticsKPIs = ({ period, onPeriodChange, analytics, isLoading }: AdminAnalyticsKPIsProps) => {
  const handleExportCSV = () => {
    if (!analytics) return;
    
    const csv = [
      ['Date', 'Transactions', 'Users', 'Volume'],
      ...analytics.timeSeries.map(d => [d.date, d.transactions, d.users, d.volume]),
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${period}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-CH', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <Tabs value={period} onValueChange={(v) => onPeriodChange(v as AnalyticsPeriod)}>
        <TabsList className="w-full">
          <TabsTrigger value="7d" className="flex-1">7 jours</TabsTrigger>
          <TabsTrigger value="30d" className="flex-1">30 jours</TabsTrigger>
          <TabsTrigger value="90d" className="flex-1">90 jours</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* KPI Cards */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalTransactions}</div>
            <p className="text-xs text-muted-foreground">Sur les {period}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Volume EUR</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(analytics.currencyVolumes.find(cv => cv.currency === 'EUR')?.volume || 0)} €
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics.currencyVolumes.find(cv => cv.currency === 'EUR')?.count || 0} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Volume CHF</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(analytics.currencyVolumes.find(cv => cv.currency === 'CHF')?.volume || 0)} CHF
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics.currencyVolumes.find(cv => cv.currency === 'CHF')?.count || 0} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nouveaux Utilisateurs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalUsers}</div>
            <p className="text-xs text-muted-foreground">Sur les {period}</p>
          </CardContent>
        </Card>
      </div>

      {/* Export Button */}
      <Button onClick={handleExportCSV} variant="outline" className="w-full">
        <Download className="mr-2 h-4 w-4" />
        Exporter CSV
      </Button>
    </div>
  );
};
