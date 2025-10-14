/**
 * Application-wide constants
 * Centralized configuration for timeouts, limits, and app settings
 */

// Storage Keys
export const STORAGE_KEYS = {
  TRANSACTIONS_SORT: 'rivvlock-transactions-sort',
  LAST_SEEN: 'last_seen',
  LANGUAGE: 'i18nextLng',
} as const;

// Time Constants (in milliseconds)
export const TIME = {
  ONE_SECOND: 1000,
  ONE_MINUTE: 60 * 1000,
  ONE_HOUR: 60 * 60 * 1000,
  ONE_DAY: 24 * 60 * 60 * 1000,
  PAYMENT_DEADLINE: 48 * 60 * 60 * 1000, // 48 hours
  VALIDATION_DEADLINE: 72 * 60 * 60 * 1000, // 72 hours
  DISPUTE_DEADLINE: 7 * 24 * 60 * 60 * 1000, // 7 days
} as const;

// Query Configuration
export const QUERY_CONFIG = {
  STALE_TIME: 10 * 1000, // 10 seconds
  GC_TIME: 10 * 60 * 1000, // 10 minutes
  RETRY_DELAY: 1000,
  MAX_RETRIES: 3,
} as const;

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

// Transaction Limits
export const TRANSACTION_LIMITS = {
  MAX_TITLE_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 500,
  MIN_AMOUNT: 1,
  MAX_AMOUNT: 1000000,
  MAX_RENEWALS: 3,
  MIN_SERVICE_DATE_HOURS: 25,
} as const;

// Dispute Limits
export const DISPUTE_LIMITS = {
  MAX_REASON_LENGTH: 1000,
  MAX_MESSAGE_LENGTH: 2000,
  MAX_MESSAGES_PER_DISPUTE: 100,
  AUTO_ESCALATION_DAYS: 7,
} as const;

// Platform Fees (Stripe Connect)
export const FEES = {
  PLATFORM_FEE_RATE: 0.029, // 2.9%
  PLATFORM_FEE_FIXED: 0.25, // €0.25
} as const;

// URL Configuration
export const URLS = {
  STRIPE_DASHBOARD: 'https://dashboard.stripe.com',
  SUPPORT_EMAIL: 'contact@rivvlock.com',
  APP_URL: 'https://app.rivvlock.com',
} as const;

// Supabase Configuration
export const SUPABASE = {
  PROJECT_ID: 'slthyxqruhfuyfmextwr',
  BASE_URL: 'https://slthyxqruhfuyfmextwr.supabase.co',
} as const;

// Status Values
export const TRANSACTION_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  VALIDATED: 'validated',
  DISPUTED: 'disputed',
  EXPIRED: 'expired',
} as const;

export const DISPUTE_STATUS = {
  OPEN: 'open',
  NEGOTIATING: 'negotiating',
  RESPONDED: 'responded',
  ESCALATED: 'escalated',
  RESOLVED: 'resolved',
  RESOLVED_REFUND: 'resolved_refund',
  RESOLVED_RELEASE: 'resolved_release',
} as const;

// Refund Types
export const REFUND_STATUS = {
  NONE: 'none',
  PARTIAL: 'partial',
  FULL: 'full',
} as const;

// Currencies
export const CURRENCIES = {
  EUR: { symbol: '€', name: 'Euro', code: 'EUR' },
  CHF: { symbol: 'CHF', name: 'Swiss Franc', code: 'CHF' },
} as const;

// Countries
export const COUNTRIES = {
  FR: { name: 'France', flag: '🇫🇷', identifier: 'SIRET' },
  CH: { name: 'Switzerland', flag: '🇨🇭', identifier: 'AVS' },
  DE: { name: 'Germany', flag: '🇩🇪', identifier: 'VAT' },
  BE: { name: 'Belgium', flag: '🇧🇪', identifier: 'VAT' },
  LU: { name: 'Luxembourg', flag: '🇱🇺', identifier: 'VAT' },
} as const;

// Feature Flags
export const FEATURES = {
  STRIPE_WEBHOOKS: false,
  ADMIN_2FA: false,
  CAPTCHA: false,
  ANALYTICS_DASHBOARD: false,
} as const;
