// Centralized base URL for shareable links
// Use the correct Lovable project domain
const LOVABLE_DOMAIN = 'https://cfd5feba-e675-4ca7-b281-9639755fdc6f.lovableproject.com';

export function getAppBaseUrl(): string {
  // Prefer current origin in preview/prod to avoid 404s; fallback to canonical domain
  if (typeof window !== 'undefined' && window.location?.origin) {
    console.log('🌐 [APP-URL] Using current origin:', window.location.origin);
    return window.location.origin;
  }
  console.log('🌐 [APP-URL] Using fallback domain:', LOVABLE_DOMAIN);
  return LOVABLE_DOMAIN;
}
