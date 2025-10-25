import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { prefetchOnIdle } from '@/lib/prefetch';

/**
 * Prefetch dashboard routes after successful authentication
 * This improves perceived performance when user navigates after login
 */
export const PrefetchOnAuthSuccess = () => {
  const { session } = useAuth();

  useEffect(() => {
    if (session) {
      // Wait 2 seconds after auth, then prefetch likely routes
      prefetchOnIdle([
        '/dashboard',
        '/dashboard/transactions',
        '/dashboard/quotes',
      ], 2000);
    }
  }, [session]);

  return null;
};
