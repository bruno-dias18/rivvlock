// Simple utilities for URL handling

export const getAppBaseUrl = (): string => {
  if (typeof window === 'undefined') {
    return 'https://rivvlock.com';
  }
  return window.location.origin;
};

export const getPublicBaseUrl = (): string => {
  if (typeof window === 'undefined') {
    return 'https://rivvlock.lovable.app';
  }
  
  const host = window.location.host;
  
  // If we're on a Lovable development/editor domain, use the public domain
  if (host.includes('lovable.dev') || 
      host.includes('lovableproject.com') || 
      host.match(/^[a-f0-9-]+\.lovable\.app$/)) {
    return 'https://rivvlock.lovable.app';
  }
  
  // Otherwise use the current origin
  return window.location.origin;
};

export const isObsoleteUrl = (): boolean => {
  if (typeof window === 'undefined') return false;
  return false; // For simplicity, we'll consider no URL as obsolete
};

export const forceCorrectUrl = (): void => {
  // For simplicity, we'll do nothing here
  console.log('URL correction not needed');
};