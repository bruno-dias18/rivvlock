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
} as const;

// Dispute Limits
export const DISPUTE_LIMITS = {
  MAX_REASON_LENGTH: 1000,
  MAX_MESSAGE_LENGTH: 2000,
} as const;

// Platform Fees
export const FEES = {
  PLATFORM_FEE_RATE: 0.05, // 5%
} as const;

// URL Configuration
export const URLS = {
  STRIPE_DASHBOARD: 'https://dashboard.stripe.com',
  SUPPORT_EMAIL: 'support@rivvlock.com',
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
