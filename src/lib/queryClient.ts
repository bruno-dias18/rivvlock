import { QueryClient } from '@tanstack/react-query';
import { logger } from './logger';

// Optimized QueryClient configuration for production
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10000, // 10 seconds - better caching with realtime updates
      gcTime: 600000, // 10 minutes - keep data longer in cache
      retry: 2, // Retry failed requests twice
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      refetchOnWindowFocus: false, // Don't refetch on window focus
      refetchOnReconnect: true, // Refetch on reconnect
      refetchOnMount: false, // Don't refetch on every mount - use cache first
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
