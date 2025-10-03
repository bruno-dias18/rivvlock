import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

export const useAutoSync = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const syncInProgressRef = useRef(false);
  const lastSyncRef = useRef<number>(0);

  const syncPayments = async (forceSync = false) => {
    if (!user || (syncInProgressRef.current && !forceSync)) {
      return;
    }

    // Avoid redundant calls (minimum 15 seconds between syncs, unless forced)
    const now = Date.now();
    if (!forceSync && now - lastSyncRef.current < 15000) {
      return;
    }

    try {
      syncInProgressRef.current = true;
      lastSyncRef.current = now;

      const { data, error } = await supabase.functions.invoke('sync-stripe-payments');
      
      if (error) {
        logger.error('Auto-sync error:', error);
        return;
      }

      if (data?.transactions_updated > 0) {
        // Force refetch instead of just invalidating
        await queryClient.refetchQueries({ queryKey: ['transactions'] });
        await queryClient.refetchQueries({ queryKey: ['transaction-counts'] });
      }

      return data;
    } catch (error) {
      logger.error('❌ Auto-sync failed:', error);
      throw error;
    } finally {
      syncInProgressRef.current = false;
    }
  };

  // Auto-sync on user login/session change
  useEffect(() => {
    if (user) {
      // Sync immediately when user logs in
      const timer = setTimeout(() => syncPayments(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [user?.id]);

  // Periodic sync every 1 minute (more aggressive)
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(syncPayments, 60000); // 1 minute
    return () => {
      clearInterval(interval);
    };
  }, [user?.id]);

  // Sync when tab becomes visible (user returns to app)
  useEffect(() => {
    if (!user) return;

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        setTimeout(syncPayments, 1000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user?.id]);

  return { syncPayments };
};