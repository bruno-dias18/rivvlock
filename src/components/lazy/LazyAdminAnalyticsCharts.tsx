import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const AdminAnalyticsCharts = lazy(() => 
  import('@/components/AdminAnalyticsCharts').then(module => ({
    default: module.AdminAnalyticsCharts
  }))
);

interface LazyAdminAnalyticsChartsProps {
  analytics: {
    timeSeries: Array<{ date: string; transactions: number; users: number; volume: number }>;
    statusDistribution: Array<{ status: string; count: number; percentage: number }>;
    currencyVolumes: Array<{ currency: string; volume: number; count: number }>;
  } | undefined;
  isLoading: boolean;
}

export const LazyAdminAnalyticsCharts = (props: LazyAdminAnalyticsChartsProps) => {
  return (
    <Suspense fallback={
      <div className="space-y-4">
        <Skeleton className="h-[300px] w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-[250px] w-full" />
          <Skeleton className="h-[250px] w-full" />
        </div>
      </div>
    }>
      <AdminAnalyticsCharts {...props} />
    </Suspense>
  );
};
