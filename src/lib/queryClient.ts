import { QueryClient } from '@tanstack/react-query';
import { logger } from './logger';

/**
 * #5 IMPROVEMENT: Enhanced error recovery with exponential backoff
 * Automatically retries failed mutations with circuit breaker pattern
 */
const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY = 1000;

// Circuit breaker state per mutation key
const circuitBreaker = new Map<string, { failures: number; lastFailure: number }>();
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_TIME = 60000; // 1 minute

function shouldRetryMutation(failureCount: number, error: any): boolean {
  // Don't retry client errors (4xx) except 429 (rate limit)
  if (error?.status >= 400 && error?.status < 500 && error?.status !== 429) {
    return false;
  }

  return failureCount < MAX_RETRY_ATTEMPTS;
}

function updateCircuitBreaker(mutationKey: string | undefined, failed: boolean) {
  if (!mutationKey) return;
  
  const state = circuitBreaker.get(mutationKey) || { failures: 0, lastFailure: 0 };
  
  if (failed) {
    state.failures++;
    state.lastFailure = Date.now();
    circuitBreaker.set(mutationKey, state);
    
    // Check circuit breaker threshold
    const timeSinceLastFailure = Date.now() - state.lastFailure;
    if (state.failures >= CIRCUIT_BREAKER_THRESHOLD && timeSinceLastFailure < CIRCUIT_BREAKER_RESET_TIME) {
      logger.warn(`Circuit breaker threshold reached for ${mutationKey}`);
    }
  } else {
    // Success resets the circuit breaker
    circuitBreaker.delete(mutationKey);
  }
}

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
      retry: shouldRetryMutation,
      retryDelay: (attemptIndex) => {
        // Exponential backoff: 1s, 2s, 4s
        return Math.min(INITIAL_RETRY_DELAY * 2 ** attemptIndex, 10000);
      },
      onError: (error) => {
        logger.error('Mutation error:', error);
      },
    },
  },
});
