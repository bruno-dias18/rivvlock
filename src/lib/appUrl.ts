// Centralized base URL for shareable links
// Lovable does not support VITE_* env vars at runtime, so we hardcode the production domain
const APP_BASE_URL = 'https://app.rivvlock.com';

export function getAppBaseUrl(): string {
  return APP_BASE_URL;
}
