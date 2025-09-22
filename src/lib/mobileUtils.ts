// Simple mobile utilities

export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth <= 768;
};

export const forceMobileRefresh = (): void => {
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
};

export const clearMobileCache = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.clear();
    sessionStorage.clear();
  }
};

export const getMobileNetworkType = (): string => {
  return 'wifi'; // Simplified version
};

export const isMobileConnectionSlow = (): boolean => {
  return false; // Simplified version
};