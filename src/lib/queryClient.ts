import { QueryClient } from '@tanstack/react-query';
import { logger } from './logger';

// Optimized QueryClient configuration
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000, // 5 seconds - realtime updates handle freshness
      gcTime: 300000, // 5 minutes - keep unused data in cache
      retry: 2, // Retry failed requests twice
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      refetchOnWindowFocus: false, // Don't refetch on window focus
      refetchOnReconnect: true, // Refetch on reconnect
      refetchOnMount: true, // Refetch on component mount
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
