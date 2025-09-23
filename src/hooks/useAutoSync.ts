import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const useAutoSync = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const syncInProgressRef = useRef(false);
  const lastSyncRef = useRef<number>(0);

  const syncPayments = async () => {
    if (!user || syncInProgressRef.current) {
      return;
    }

    // Avoid redundant calls (minimum 30 seconds between syncs)
    const now = Date.now();
    if (now - lastSyncRef.current < 30000) {
      return;
    }

    try {
      syncInProgressRef.current = true;
      lastSyncRef.current = now;

      const { data, error } = await supabase.functions.invoke('sync-stripe-payments');
      
      if (error) {
        console.error('Auto-sync error:', error);
        return;
      }

      if (data?.transactions_updated > 0) {
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        queryClient.invalidateQueries({ queryKey: ['transaction-counts'] });
        
        toast.success(`${data.transactions_updated} transaction(s) synchronisée(s)`);
      }

      return data;
    } catch (error) {
      console.error('Auto-sync failed:', error);
    } finally {
      syncInProgressRef.current = false;
    }
  };

  // Auto-sync on user login/session change
  useEffect(() => {
    if (user) {
      // Sync after a short delay when user logs in
      const timer = setTimeout(syncPayments, 2000);
      return () => clearTimeout(timer);
    }
  }, [user?.id]);

  // Periodic sync every 3 minutes
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(syncPayments, 180000); // 3 minutes
    return () => clearInterval(interval);
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