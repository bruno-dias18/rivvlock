import { useState, useEffect } from 'react';

interface CacheData {
  data: any;
  timestamp: number;
  expiry: number;
}

export const useOfflineCache = <T>(key: string, fetcher: () => Promise<T>, ttl: number = 5 * 60 * 1000) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const cacheKey = `rivvlock_cache_${key}`;

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Get data from cache
  const getCachedData = (): T | null => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;

      const parsedCache: CacheData = JSON.parse(cached);
      const now = Date.now();

      // Check if cache is still valid
      if (now < parsedCache.expiry) {
        return parsedCache.data;
      }

      // Remove expired cache
      localStorage.removeItem(cacheKey);
      return null;
    } catch (error) {
      localStorage.removeItem(cacheKey);
      return null;
    }
  };

  // Set data to cache
  const setCachedData = (data: T) => {
    try {
      const cacheData: CacheData = {
        data,
        timestamp: Date.now(),
        expiry: Date.now() + ttl,
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache data:', error);
    }
  };

  // Fetch data
  const fetchData = async (useCache = true) => {
    try {
      setLoading(true);
      setError(null);

      // Try cache first if offline or requested
      if (useCache) {
        const cachedData = getCachedData();
        if (cachedData) {
          setData(cachedData);
          if (isOffline) {
            setLoading(false);
            return cachedData;
          }
        }
      }

      // Fetch fresh data if online
      if (!isOffline) {
        const freshData = await fetcher();
        setData(freshData);
        setCachedData(freshData);
        setLoading(false);
        return freshData;
      }

      // If offline and no cache, use existing data or show error
      const cachedData = getCachedData();
      if (cachedData) {
        setData(cachedData);
      } else {
        setError('Données non disponibles hors ligne');
      }
      
      setLoading(false);
      return cachedData;
    } catch (err) {
      console.error('Error fetching data:', err);
      
      // Try to use cached data on error
      const cachedData = getCachedData();
      if (cachedData) {
        setData(cachedData);
        setError('Utilisation des données en cache (erreur réseau)');
      } else {
        setError('Erreur lors du chargement des données');
      }
      
      setLoading(false);
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
    refetch: () => fetchData(false),
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