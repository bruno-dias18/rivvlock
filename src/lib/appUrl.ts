/**
 * Gets the base URL for the application
 * Prioritizes VITE_APP_URL (production domain) over window.location.origin
 * This ensures that generated links always point to the production app
 */
export function getAppBaseUrl(): string {
  // Always use the production URL if available
  if (import.meta.env.VITE_APP_URL) {
    return import.meta.env.VITE_APP_URL;
  }
  
  // Fallback to current origin (for development)
  return window.location.origin;
}