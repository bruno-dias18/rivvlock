// Centralized base URL for shareable links
// IMPORTANT: Always use the preview domain that works correctly
// DO NOT CHANGE THIS - the lovableproject.com domain doesn't work
const WORKING_DOMAIN = 'https://id-preview--cfd5feba-e675-4ca7-b281-9639755fdc6f.lovable.app';

export function getAppBaseUrl(): string {
  // Always return the working domain to prevent link generation issues
  console.log('🌐 [APP-URL] Using working domain:', WORKING_DOMAIN);
  return WORKING_DOMAIN;
}
