import { useState, useEffect } from 'react';
import { isMobileDevice, isMobileConnectionSlow } from '@/lib/mobileUtils';

interface CacheData {
  data: any;
  timestamp: number;
  expiry: number;
  version: string;
  isMobile?: boolean;
}

export const useOfflineCache = <T>(key: string, fetcher: () => Promise<T>, ttl: number = 5 * 60 * 1000) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const cacheKey = `rivvlock_cache_${key}`;
  const isMobile = isMobileDevice();
  const isSlowConnection = isMobileConnectionSlow();
  const currentVersion = '1.0.0'; // App version for cache invalidation

  // Listen for online/offline events with mobile optimizations
  useEffect(() => {
    const handleOnline = () => {
      console.log('📶 [CACHE] Connection restored');
      setIsOffline(false);
      setRetryCount(0);
      
      // On mobile, wait a bit before refetching to ensure stable connection
      if (isMobile) {
        setTimeout(() => {
          fetchData(false);
        }, 1000);
      }
    };
    
    const handleOffline = () => {
      console.log('📵 [CACHE] Connection lost');
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Mobile-specific: also listen for visibility changes
    if (isMobile) {
      const handleVisibilityChange = () => {
        if (!document.hidden && navigator.onLine && data) {
          // App became visible again, check for stale data
          const cachedData = getCachedData();
          if (cachedData && Date.now() - lastSyncTime! > 30000) { // 30 seconds
            console.log('📱 [CACHE] App resumed, refreshing stale data');
            fetchData(false);
          }
        }
      };
      
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isMobile, data, lastSyncTime]);

  // Get data from cache with version checking
  const getCachedData = (): T | null => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;

      const parsedCache: CacheData = JSON.parse(cached);
      const now = Date.now();

      // Version check - invalidate if app version changed
      if (parsedCache.version !== currentVersion) {
        console.log('🔄 [CACHE] Cache invalidated due to version change');
        localStorage.removeItem(cacheKey);
        return null;
      }

      // Mobile-specific: more aggressive cache invalidation for better sync
      if (isMobile && parsedCache.isMobile) {
        const mobileStaleTime = isSlowConnection ? ttl * 2 : ttl; // Longer cache for slow connections
        if (now > parsedCache.timestamp + mobileStaleTime) {
          console.log('📱 [CACHE] Mobile cache considered stale, removing');
          localStorage.removeItem(cacheKey);
          return null;
        }
      }

      // Check if cache is still valid
      if (now < parsedCache.expiry) {
        return parsedCache.data;
      }

      // Remove expired cache
      localStorage.removeItem(cacheKey);
      return null;
    } catch (error) {
      console.error('❌ [CACHE] Error reading cache:', error);
      localStorage.removeItem(cacheKey);
      return null;
    }
  };

  // Set data to cache with mobile optimizations
  const setCachedData = (data: T) => {
    try {
      const cacheData: CacheData = {
        data,
        timestamp: Date.now(),
        expiry: Date.now() + ttl,
        version: currentVersion,
        isMobile
      };
      
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      setLastSyncTime(Date.now());
      
      console.log(`💾 [CACHE] Data cached for key: ${key} (mobile: ${isMobile})`);
    } catch (error) {
      console.error('❌ [CACHE] Failed to cache data:', error);
    }
  };

  // Fetch data with mobile optimizations and retry logic
  const fetchData = async (useCache = true, forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      // Try cache first if offline or requested (unless force refresh)
      if (useCache && !forceRefresh) {
        const cachedData = getCachedData();
        if (cachedData) {
          setData(cachedData);
          console.log(`📱 [CACHE] Using cached data for ${key}`);
          
          if (isOffline) {
            setLoading(false);
            return cachedData;
          }
        }
      }

      // Fetch fresh data if online with retry logic for mobile
      if (!isOffline) {
        let attempt = 0;
        const maxRetries = isMobile ? 3 : 1;
        
        while (attempt < maxRetries) {
          try {
            console.log(`🔄 [CACHE] Fetching fresh data for ${key} (attempt ${attempt + 1})`);
            
            const freshData = await Promise.race([
              fetcher(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), isMobile ? 15000 : 30000)
              )
            ]) as T;
            
            setData(freshData);
            setCachedData(freshData);
            setLoading(false);
            setRetryCount(0);
            
            console.log(`✅ [CACHE] Fresh data loaded for ${key}`);
            return freshData;
            
          } catch (fetchError) {
            attempt++;
            console.warn(`⚠️ [CACHE] Fetch attempt ${attempt} failed for ${key}:`, fetchError);
            
            if (attempt < maxRetries) {
              // Progressive backoff: 1s, 2s, 4s
              const delay = Math.pow(2, attempt) * 1000;
              console.log(`⏳ [CACHE] Retrying in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            } else {
              throw fetchError;
            }
          }
        }
      }

      // If offline or all retries failed, use existing cache
      const cachedData = getCachedData();
      if (cachedData) {
        setData(cachedData);
        setError(isOffline ? 'Mode hors ligne - utilisation des données en cache' : 'Erreur réseau - utilisation des données en cache');
      } else {
        setError(isOffline ? 'Données non disponibles hors ligne' : 'Erreur lors du chargement des données');
      }
      
      setLoading(false);
      setRetryCount(prev => prev + 1);
      return cachedData;
      
    } catch (err) {
      console.error(`❌ [CACHE] Error fetching data for ${key}:`, err);
      
      // Try to use cached data on error
      const cachedData = getCachedData();
      if (cachedData) {
        setData(cachedData);
        setError('Utilisation des données en cache (erreur réseau)');
      } else {
        setError('Erreur lors du chargement des données');
      }
      
      setLoading(false);
      setRetryCount(prev => prev + 1);
      return cachedData;
    }
  };

  // Initial load
  useEffect(() => {
    fetchData(true);
  }, [key]);

  // Refetch when coming back online
  useEffect(() => {
    if (!isOffline) {
      fetchData(false);
    }
  }, [isOffline]);

  return {
    data,
    loading,
    error,
    isOffline,
    isMobile,
    isSlowConnection,
    lastSyncTime,
    retryCount,
    refetch: () => fetchData(false, false),
    forceRefresh: () => fetchData(false, true),
    getCachedAge: () => {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (!cached) return null;
        const parsedCache: CacheData = JSON.parse(cached);
        return Date.now() - parsedCache.timestamp;
      } catch {
        return null;
      }
    }
  };
};