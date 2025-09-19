// Centralized base URL for shareable links
// Use production domain when deployed there, otherwise use current origin (preview/local)
const PROD_DOMAIN = 'app.rivvlock.com';

export function getAppBaseUrl(): string {
  try {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      const origin = window.location.origin;
      if (host.endsWith('lovableproject.com') || host === 'localhost' || host.endsWith('.local')) {
        return origin;
      }
    }
  } catch {}
  return `https://${PROD_DOMAIN}`;
}
