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

export const forceMobileRefresh = (): void => {
  console.log('🔄 [MOBILE] Force refreshing mobile app...');
  clearMobileCache();
  
  // Add a small delay to ensure cache is cleared
  setTimeout(() => {
    window.location.reload();
  }, 100);
};