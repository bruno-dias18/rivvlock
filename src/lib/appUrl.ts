// Centralized base URL for shareable links
// Force RIVVLOCK domain for all shareable links
const RIVVLOCK_DOMAIN = 'https://app.rivvlock.com';

export function getAppBaseUrl(): string {
  // Always return RIVVLOCK domain for consistency
  return RIVVLOCK_DOMAIN;
}
