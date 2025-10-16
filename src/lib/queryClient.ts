import { QueryClient } from '@tanstack/react-query';
import { logger } from './logger';

// Optimized QueryClient configuration for production
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60000, // 1 minute - longer cache for instant navigation
      gcTime: 1800000, // 30 minutes - keep data much longer in cache
      retry: 2, // Retry failed requests twice
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      refetchOnWindowFocus: false, // Don't refetch on window focus
      refetchOnReconnect: true, // Refetch on reconnect
      refetchOnMount: false, // ✅ Don't refetch on mount (rely on staleTime + realtime invalidation)
    },
    mutations: {
      retry: 1, // Retry mutations once
      retryDelay: 1000,
      onError: (error) => {
        logger.error('Mutation error:', error);
      },
    },
  },
});
