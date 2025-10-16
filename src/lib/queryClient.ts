import { QueryClient } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { del, get, set } from 'idb-keyval';
import { logger } from './logger';

// Custom IndexedDB persister (more reliable than localStorage for large data)
const createIDBPersister = () => {
  return {
    persistClient: async (client: any) => {
      await set('REACT_QUERY_OFFLINE_CACHE', client);
    },
    restoreClient: async () => {
      return await get('REACT_QUERY_OFFLINE_CACHE');
    },
    removeClient: async () => {
      await del('REACT_QUERY_OFFLINE_CACHE');
    },
  };
};

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

// Initialize persister only in browser environment (Phase 6: Persistent Cache)
if (typeof window !== 'undefined') {
  const idbPersister = createIDBPersister();
  
  persistQueryClient({
    queryClient,
    persister: idbPersister,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    dehydrateOptions: {
      // Don't persist queries with errors or that are currently fetching
      shouldDehydrateQuery: (query) => {
        return query.state.status === 'success' && query.state.dataUpdatedAt > 0;
      },
    },
  });
}
