import { QueryClient } from '@tanstack/react-query';
import { logger } from './logger';

// Optimized QueryClient configuration for production
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds - optimized caching with realtime updates
      gcTime: 900000, // 15 minutes - keep data longer in cache
      retry: 2, // Retry failed requests twice
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      refetchOnWindowFocus: false, // Don't refetch on window focus
      refetchOnReconnect: true, // Refetch on reconnect
      refetchOnMount: true, // ✅ Allow components to see fresh data on remount
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
