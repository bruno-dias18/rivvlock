import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { isMobileDevice, clearMobileCache, getMobileNetworkType } from '@/lib/mobileUtils';

interface MobileSyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  syncError: string | null;
  networkType: string;
  dataConsistencyCheck: boolean;
}

export const useMobileSync = () => {
  const { user, session } = useAuth();
  const [syncStatus, setSyncStatus] = useState<MobileSyncStatus>({
    isOnline: navigator.onLine,
    isSyncing: false,
    lastSyncTime: null,
    syncError: null,
    networkType: 'unknown',
    dataConsistencyCheck: false
  });

  const isMobile = isMobileDevice();

  // Monitor network changes
  useEffect(() => {
    const handleOnline = () => {
      console.log('📶 [MOBILE-SYNC] Connection restored');
      setSyncStatus(prev => ({ ...prev, isOnline: true, syncError: null }));
      
      if (isMobile && user) {
        // Trigger sync when coming back online
        setTimeout(() => {
          performFullSync();
        }, 1000);
      }
    };

    const handleOffline = () => {
      console.log('📵 [MOBILE-SYNC] Connection lost');
      setSyncStatus(prev => ({ 
        ...prev, 
        isOnline: false, 
        isSyncing: false,
        syncError: 'Connexion perdue' 
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isMobile, user]);

  // Update network type periodically
  useEffect(() => {
    const updateNetworkInfo = () => {
      setSyncStatus(prev => ({
        ...prev,
        networkType: getMobileNetworkType()
      }));
    };

    updateNetworkInfo();
    const interval = setInterval(updateNetworkInfo, 10000);
    
    return () => clearInterval(interval);
  }, []);

  // Mobile-specific: Check for data consistency issues
  const checkDataConsistency = useCallback(async (): Promise<boolean> => {
    if (!user || !syncStatus.isOnline) return false;

    try {
      setSyncStatus(prev => ({ ...prev, dataConsistencyCheck: true }));

      // Check if user can access their own data
      const { data: testQuery, error } = await supabase
        .from('transactions')
        .select('id, updated_at')
        .or(`user_id.eq.${user.id},buyer_id.eq.${user.id}`)
        .limit(1);

      if (error) {
        console.error('❌ [MOBILE-SYNC] Data consistency check failed:', error);
        setSyncStatus(prev => ({ 
          ...prev, 
          syncError: 'Erreur d\'authentification - veuillez vous reconnecter',
          dataConsistencyCheck: false
        }));
        return false;
      }

      setSyncStatus(prev => ({ ...prev, dataConsistencyCheck: false }));
      return true;

    } catch (error) {
      console.error('❌ [MOBILE-SYNC] Consistency check exception:', error);
      setSyncStatus(prev => ({ 
        ...prev, 
        syncError: 'Vérification échouée',
        dataConsistencyCheck: false
      }));
      return false;
    }
  }, [user, syncStatus.isOnline]);

  // Perform full synchronization
  const performFullSync = useCallback(async () => {
    if (!user || syncStatus.isSyncing || !syncStatus.isOnline) {
      return false;
    }

    try {
      console.log('🔄 [MOBILE-SYNC] Starting full sync...');
      setSyncStatus(prev => ({ 
        ...prev, 
        isSyncing: true, 
        syncError: null 
      }));

      // Step 1: Check authentication is still valid
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !currentSession) {
        throw new Error('Session invalide - reconnexion requise');
      }

      // Step 2: Check data consistency
      const isConsistent = await checkDataConsistency();
      if (!isConsistent) {
        throw new Error('Problème de cohérence des données');
      }

      // Step 3: Clear stale cache on mobile
      if (isMobile) {
        console.log('🧹 [MOBILE-SYNC] Clearing mobile cache...');
        clearMobileCache();
      }

      // Step 4: Trigger real-time subscription refresh
      console.log('📡 [MOBILE-SYNC] Refreshing real-time subscriptions...');
      
      setSyncStatus(prev => ({ 
        ...prev, 
        isSyncing: false,
        lastSyncTime: new Date(),
        syncError: null
      }));

      console.log('✅ [MOBILE-SYNC] Full sync completed successfully');
      return true;

    } catch (error) {
      console.error('❌ [MOBILE-SYNC] Full sync failed:', error);
      
      setSyncStatus(prev => ({ 
        ...prev, 
        isSyncing: false,
        syncError: error instanceof Error ? error.message : 'Erreur de synchronisation'
      }));
      
      return false;
    }
  }, [user, syncStatus.isSyncing, syncStatus.isOnline, isMobile, checkDataConsistency]);

  // Force complete app refresh (for critical issues)
  const forceAppRefresh = useCallback(() => {
    console.log('🔄 [MOBILE-SYNC] Forcing complete app refresh...');
    
    // Clear everything
    clearMobileCache();
    
    // Clear Supabase auth
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') || key.startsWith('supabase.auth.'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    // Reload app
    setTimeout(() => {
      window.location.reload();
    }, 100);
  }, []);

  // Mobile-specific: Sync on app resume
  useEffect(() => {
    if (!isMobile) return;

    const handleVisibilityChange = () => {
      if (!document.hidden && syncStatus.isOnline && user) {
        // App became visible, check if sync needed
        const timeSinceLastSync = syncStatus.lastSyncTime 
          ? Date.now() - syncStatus.lastSyncTime.getTime() 
          : Infinity;
          
        // Sync if more than 30 seconds since last sync
        if (timeSinceLastSync > 30000) {
          console.log('📱 [MOBILE-SYNC] App resumed, triggering sync');
          setTimeout(() => performFullSync(), 1000);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isMobile, syncStatus.isOnline, syncStatus.lastSyncTime, user, performFullSync]);

  // Auto-sync periodically on mobile
  useEffect(() => {
    if (!isMobile || !user || !syncStatus.isOnline) return;

    const interval = setInterval(() => {
      const timeSinceLastSync = syncStatus.lastSyncTime 
        ? Date.now() - syncStatus.lastSyncTime.getTime() 
        : Infinity;
        
      // Auto-sync every 2 minutes on mobile
      if (timeSinceLastSync > 2 * 60 * 1000) {
        console.log('⏰ [MOBILE-SYNC] Auto-sync triggered');
        performFullSync();
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [isMobile, user, syncStatus.isOnline, syncStatus.lastSyncTime, performFullSync]);

  return {
    syncStatus,
    performFullSync,
    forceAppRefresh,
    checkDataConsistency,
    isMobileDevice: isMobile
  };
};