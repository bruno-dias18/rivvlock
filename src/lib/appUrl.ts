// Simple utilities for URL handling

export const getAppBaseUrl = (): string => {
  if (typeof window === 'undefined') {
    return 'https://rivvlock.com';
  }
  return window.location.origin;
};

export const getPublicBaseUrl = (): string => {
  if (typeof window === 'undefined') {
    return 'https://app.rivvlock.com';
  }
  
  const host = window.location.host;
  
  // If we're on a Lovable development/editor domain, use the custom domain
  if (host.includes('lovable.dev') || 
      host.includes('lovableproject.com') || 
      host.match(/^[a-f0-9-]+\.lovable\.app$/)) {
    return 'https://app.rivvlock.com';
  }
  
  // Otherwise use the current origin
  return window.location.origin;
};

export const isObsoleteUrl = (): boolean => {
  if (typeof window === 'undefined') return false;
  const host = window.location.host;
  // Consider editor/preview domains obsolete for shared/public links
  const isEditorOrPreview = host.includes('lovable.dev') ||
    host.includes('lovableproject.com') ||
    /^[a-f0-9-]+\.lovable\.app$/.test(host);
  return isEditorOrPreview;
};

export const forceCorrectUrl = (): void => {
  if (typeof window === 'undefined') return;
  try {
    if (isObsoleteUrl()) {
      const targetBase = getPublicBaseUrl();
      const targetUrl = `${targetBase}${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (window.location.href !== targetUrl) {
        // Use replace to avoid polluting history
        window.location.replace(targetUrl);
      }
    }
  } catch (e) {
    // URL correction skipped
  }
};