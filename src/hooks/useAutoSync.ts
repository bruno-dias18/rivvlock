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

  const syncPayments = async (forceSync = false) => {
    console.log('🔄 Auto-sync triggered', { user: user?.email, inProgress: syncInProgressRef.current, forceSync });
    
    if (!user || (syncInProgressRef.current && !forceSync)) {
      console.log('❌ Auto-sync skipped', { noUser: !user, inProgress: syncInProgressRef.current });
      return;
    }

    // Avoid redundant calls (minimum 15 seconds between syncs, unless forced)
    const now = Date.now();
    if (!forceSync && now - lastSyncRef.current < 15000) {
      console.log('❌ Auto-sync rate limited', { timeSinceLastSync: now - lastSyncRef.current });
      return;
    }

    try {
      syncInProgressRef.current = true;
      lastSyncRef.current = now;
      console.log('🚀 Starting sync-stripe-payments for user:', user.email);

      const { data, error } = await supabase.functions.invoke('sync-stripe-payments');
      
      if (error) {
        console.error('❌ Auto-sync error:', error);
        return;
      }

      console.log('✅ Sync completed', data);

      if (data?.transactions_updated > 0) {
        console.log(`🔄 Invalidating queries - ${data.transactions_updated} transactions updated`);
        // Force refetch instead of just invalidating
        await queryClient.refetchQueries({ queryKey: ['transactions'] });
        await queryClient.refetchQueries({ queryKey: ['transaction-counts'] });
        
        toast.success(`${data.transactions_updated} transaction(s) synchronisée(s)`);
      } else {
        console.log('ℹ️ No transactions updated');
      }

      return data;
    } catch (error) {
      console.error('❌ Auto-sync failed:', error);
      throw error;
    } finally {
      syncInProgressRef.current = false;
    }
  };

  // Auto-sync on user login/session change
  useEffect(() => {
    if (user) {
      console.log('👤 User login detected, scheduling initial sync for:', user.email);
      // Sync immediately when user logs in
      const timer = setTimeout(() => syncPayments(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [user?.id]);

  // Periodic sync every 1 minute (more aggressive)
  useEffect(() => {
    if (!user) return;

    console.log('⏰ Setting up 1-minute sync interval for:', user.email);
    const interval = setInterval(syncPayments, 60000); // 1 minute
    return () => {
      console.log('🛑 Clearing sync interval');
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