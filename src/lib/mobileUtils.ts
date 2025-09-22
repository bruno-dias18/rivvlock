// Mobile detection and optimization utilities

export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth <= 768;
  
  return isMobile || (isTouch && isSmallScreen);
};

export const isIOSDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent);
};

export const isSafari = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent.toLowerCase();
  return userAgent.includes('safari') && !userAgent.includes('chrome');
};

export const isStandalonePWA = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone ||
    document.referrer.includes('android-app://')
  );
};

export const getMobileNetworkType = (): string => {
  if (typeof navigator === 'undefined') return 'unknown';
  
  const connection = (navigator as any).connection || 
                   (navigator as any).mozConnection || 
                   (navigator as any).webkitConnection;
                   
  return connection ? connection.effectiveType || 'unknown' : 'unknown';
};

export const isMobileConnectionSlow = (): boolean => {
  const networkType = getMobileNetworkType();
  return ['slow-2g', '2g'].includes(networkType);
};

export const clearMobileCache = (): void => {
  if (typeof localStorage === 'undefined') return;
  
  console.log('🧹 [MOBILE] Clearing mobile cache...');
  
  // Clear all rivvlock cache entries
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('rivvlock_cache_')) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    console.log(`🧹 [MOBILE] Removed cache key: ${key}`);
  });
  
  console.log(`🧹 [MOBILE] Cleared ${keysToRemove.length} cache entries`);
};

// Nettoyage complet de tous les caches mobiles
export const clearAllMobileCaches = async (): Promise<void> => {
  console.log('🧹 [MOBILE] Starting complete cache cleanup...');
  
  try {
    // 1. Vider localStorage
    if (typeof localStorage !== 'undefined') {
      const allKeys = Object.keys(localStorage);
      const supabaseKeys = allKeys.filter(key => 
        key.startsWith('sb-') || 
        key.startsWith('supabase.') ||
        key.startsWith('rivvlock_') ||
        key.includes('session') ||
        key.includes('auth')
      );
      
      supabaseKeys.forEach(key => {
        localStorage.removeItem(key);
        console.log(`🧹 [MOBILE] Removed localStorage key: ${key}`);
      });
      
      console.log(`🧹 [MOBILE] Cleared ${supabaseKeys.length} localStorage entries`);
    }
    
    // 2. Vider sessionStorage
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
      console.log('🧹 [MOBILE] Cleared sessionStorage');
    }
    
    // 3. Vider les caches du service worker
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      console.log('🧹 [MOBILE] Found caches:', cacheNames);
      
      await Promise.all(
        cacheNames.map(async (cacheName) => {
          await caches.delete(cacheName);
          console.log(`🧹 [MOBILE] Deleted cache: ${cacheName}`);
        })
      );
    }
    
    // 4. Forcer l'actualisation du service worker
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
        console.log('🧹 [MOBILE] Unregistered service worker');
      }
    }
    
    console.log('✅ [MOBILE] Complete cache cleanup finished');
  } catch (error) {
    console.error('❌ [MOBILE] Error during cache cleanup:', error);
  }
};

// Fonction pour détecter et corriger les URLs obsolètes
export const detectAndFixObsoleteUrls = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const currentOrigin = window.location.origin;
  const obsoleteUrls = [
    'https://rivv-secure-escrow.lovable.app',
    'https://lovableproject.com'
  ];
  
  if (obsoleteUrls.includes(currentOrigin)) {
    console.warn('⚠️ [MOBILE] OBSOLETE URL DETECTED:', currentOrigin);
    console.log('🔄 [MOBILE] Redirecting to correct URL...');
    
    const correctUrl = 'https://id-preview--cfd5feba-e675-4ca7-b281-9639755fdc6f.lovable.app';
    const newUrl = correctUrl + window.location.pathname + window.location.search;
    
    // Redirection immédiate
    window.location.replace(newUrl);
    return true;
  }
  
  return false;
};

export const forceMobileRefresh = (): void => {
  console.log('🔄 [MOBILE] Force refreshing mobile app...');
  
  // Détecter et corriger les URLs obsolètes avant le refresh
  if (detectAndFixObsoleteUrls()) {
    return; // La redirection se charge du refresh
  }
  
  clearMobileCache();
  
  // Add a small delay to ensure cache is cleared
  setTimeout(() => {
    console.log('🔄 [MOBILE] Reloading page...');
    window.location.reload();
  }, 100);
};

// Reset complet de l'application mobile
export const resetMobileApp = async (): Promise<void> => {
  console.log('🔄 [MOBILE] Starting complete mobile app reset...');
  
  try {
    // 1. Vérifier et corriger les URLs obsolètes
    if (detectAndFixObsoleteUrls()) {
      return; // La redirection se charge du reset
    }
    
    // 2. Nettoyage complet des caches
    await clearAllMobileCaches();
    
    // 3. Petit délai pour s'assurer que tout est nettoyé
    setTimeout(() => {
      console.log('🔄 [MOBILE] Reloading with fresh state...');
      window.location.reload();
    }, 200);
    
  } catch (error) {
    console.error('❌ [MOBILE] Error during mobile app reset:', error);
    // Fallback: simple reload
    setTimeout(() => {
      window.location.reload();
    }, 100);
  }
};