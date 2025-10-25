import { useEffect } from 'react';
import { usePushNotifications } from './usePushNotifications';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

/**
 * Hook to automatically sync push subscription with the backend
 * - Re-subscribes if subscription expired
 * - Syncs on login
 */
export const usePushSubscriptionSync = () => {
  const { 
    permission, 
    isSupported, 
    isSubscribed, 
    subscribeToPush 
  } = usePushNotifications();

  useEffect(() => {
    if (!isSupported) return;

    const syncSubscription = async () => {
      try {
        // Check if user is authenticated
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          return; // Not logged in
        }

        // If permission granted but not subscribed, re-subscribe
        if (permission === 'granted' && !isSubscribed) {
          logger.info('Re-subscribing to push notifications');
          await subscribeToPush();
        }
      } catch (error) {
        logger.error('Error syncing push subscription:', error);
      }
    };

    // Sync on mount
    syncSubscription();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // User just logged in, sync subscription
        syncSubscription();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isSupported, permission, isSubscribed, subscribeToPush]);
};
