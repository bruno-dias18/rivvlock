// Centralized base URL for shareable links
// Use the correct Lovable project domain
const LOVABLE_DOMAIN = 'https://rivv-secure-escrow.lovable.app';

export function getAppBaseUrl(): string {
  // Prefer current origin in preview/prod to avoid 404s; fallback to canonical domain
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return LOVABLE_DOMAIN;
}
