// Simple utilities for URL handling

export const getAppBaseUrl = (): string => {
  if (typeof window === 'undefined') {
    return 'https://rivvlock.com';
  }
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