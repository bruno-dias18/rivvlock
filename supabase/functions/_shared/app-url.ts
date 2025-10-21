// Utilities for URL handling in edge functions
// Ensures correct public URLs for shared links (quotes and transactions)

/**
 * Get the public base URL for the application
 * Always returns the production custom domain
 */
export const getPublicBaseUrl = (): string => {
  return 'https://app.rivvlock.com';
};

/**
 * Get the app base URL (can be used for internal references)
 */
export const getAppBaseUrl = (): string => {
  return 'https://rivvlock.com';
};

/**
 * Build a quote view URL with secure token
 */
export const buildQuoteViewUrl = (secureToken: string, quoteId: string): string => {
  const baseUrl = getPublicBaseUrl();
  return `${baseUrl}/quote-view/${secureToken}?quoteId=${quoteId}`;
};

/**
 * Build a transaction join URL with secure token
 */
export const buildTransactionJoinUrl = (secureToken: string): string => {
  const baseUrl = getPublicBaseUrl();
  return `${baseUrl}/join/${secureToken}`;
};
