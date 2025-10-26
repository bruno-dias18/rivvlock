/**
 * Adyen Configuration
 * Public client key - safe to expose in frontend code
 */

export const ADYEN_CONFIG = {
  // ✅ Public client key (safe to commit)
  clientKey: 'test_OWY3UZADWZGKHHBNQM7ZEWTJAQMZJHMH',
  
  // Environment
  environment: 'test', // Use 'live' for production
  
  // Supported payment methods
  supportedMethods: ['visa', 'mc', 'twint', 'bankTransfer_IBAN'] as const,
  
  // ✅ Blocked payment methods to protect margins
  blockedMethods: ['amex'] as const,
  
  // Default locale
  locale: 'fr-CH',
} as const;

export type AdyenPaymentMethod = typeof ADYEN_CONFIG.supportedMethods[number];
