/**
 * Centralized error messages with i18n support
 * Provides user-friendly error messages for common scenarios
 */

import i18n from '@/i18n/config';

export interface ErrorContext {
  code?: string;
  statusCode?: number;
  details?: any;
}

/**
 * Convert technical error to user-friendly message
 */
export const getUserFriendlyError = (error: any, context?: ErrorContext): string => {
  const errorMessage = error?.message || String(error);
  const errorCode = error?.code || context?.code;
  const statusCode = error?.statusCode || context?.statusCode;

  // Authentication errors
  if (errorCode === 'invalid_credentials' || errorMessage.includes('Invalid login credentials')) {
    return i18n.t('errors.auth.invalidCredentials', { 
      defaultValue: 'Invalid email or password. Please try again.' 
    });
  }
  
  if (errorCode === 'email_not_confirmed') {
    return i18n.t('errors.auth.emailNotConfirmed', { 
      defaultValue: 'Please verify your email address before logging in.' 
    });
  }
  
  if (errorCode === 'user_not_found') {
    return i18n.t('errors.auth.userNotFound', { 
      defaultValue: 'No account found with this email address.' 
    });
  }

  // Stripe errors
  if (errorMessage.includes('stripe') || errorMessage.includes('payment')) {
    if (errorMessage.includes('card_declined')) {
      return i18n.t('errors.payment.cardDeclined', { 
        defaultValue: 'Your card was declined. Please use a different payment method.' 
      });
    }
    
    if (errorMessage.includes('insufficient_funds')) {
      return i18n.t('errors.payment.insufficientFunds', { 
        defaultValue: 'Insufficient funds. Please check your account balance.' 
      });
    }
    
    if (errorMessage.includes('payment_intent')) {
      return i18n.t('errors.payment.intentFailed', { 
        defaultValue: 'Payment processing failed. Please try again.' 
      });
    }
    
    return i18n.t('errors.payment.generic', { 
      defaultValue: 'Payment error. Please contact support if the issue persists.' 
    });
  }

  // Network errors
  if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
    return i18n.t('errors.network.connectionFailed', { 
      defaultValue: 'Connection failed. Please check your internet connection.' 
    });
  }
  
  if (statusCode === 408 || errorMessage.includes('timeout')) {
    return i18n.t('errors.network.timeout', { 
      defaultValue: 'Request timed out. Please try again.' 
    });
  }

  // Database/Supabase errors
  if (errorCode === 'PGRST116' || errorMessage.includes('not found')) {
    return i18n.t('errors.database.notFound', { 
      defaultValue: 'The requested resource was not found.' 
    });
  }
  
  if (errorCode?.startsWith('23') || errorMessage.includes('constraint')) {
    return i18n.t('errors.database.constraint', { 
      defaultValue: 'This action violates database constraints. Please check your input.' 
    });
  }

  // Validation errors
  if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
    return i18n.t('errors.validation.generic', { 
      defaultValue: 'Invalid input. Please check your data and try again.' 
    });
  }

  // Permission errors
  if (statusCode === 403 || errorMessage.includes('forbidden') || errorMessage.includes('unauthorized')) {
    return i18n.t('errors.permission.denied', { 
      defaultValue: 'You do not have permission to perform this action.' 
    });
  }

  // Rate limiting
  if (statusCode === 429 || errorMessage.includes('rate limit')) {
    return i18n.t('errors.rateLimit.exceeded', { 
      defaultValue: 'Too many requests. Please wait a moment and try again.' 
    });
  }

  // Server errors
  if (statusCode && statusCode >= 500) {
    return i18n.t('errors.server.generic', { 
      defaultValue: 'Server error. Our team has been notified. Please try again later.' 
    });
  }

  // Default fallback
  return i18n.t('errors.generic', { 
    defaultValue: 'An unexpected error occurred. Please try again.' 
  });
};

/**
 * Error messages for specific operations
 */
export const ErrorMessages = {
  // Transactions
  TRANSACTION_CREATE_FAILED: 'Failed to create transaction. Please try again.',
  TRANSACTION_NOT_FOUND: 'Transaction not found or you do not have access to it.',
  TRANSACTION_ALREADY_COMPLETED: 'This transaction has already been completed.',
  TRANSACTION_EXPIRED: 'This transaction has expired.',
  PAYMENT_DEADLINE_PASSED: 'Payment deadline has passed.',
  VALIDATION_PERIOD_ACTIVE: 'Cannot complete transaction during validation period.',
  
  // Disputes
  DISPUTE_CREATE_FAILED: 'Failed to create dispute. Please try again.',
  DISPUTE_NOT_IN_VALIDATION: 'Disputes can only be created during validation period.',
  DISPUTE_ALREADY_EXISTS: 'A dispute already exists for this transaction.',
  DISPUTE_MESSAGE_LIMIT: 'Maximum 100 messages per dispute reached.',
  DISPUTE_PROPOSAL_FAILED: 'Failed to create proposal. Please try again.',
  
  // Stripe
  STRIPE_ACCOUNT_NOT_SETUP: 'Please complete your Stripe account setup to receive payments.',
  STRIPE_PAYMENT_FAILED: 'Payment processing failed. Please try again.',
  STRIPE_CAPTURE_FAILED: 'Failed to capture payment. Please contact support.',
  STRIPE_TRANSFER_FAILED: 'Failed to transfer funds. Please contact support.',
  
  // Admin
  ADMIN_ACCESS_DENIED: 'Admin access required.',
  ADMIN_ACTION_FAILED: 'Admin action failed. Please try again.',
  
  // Profile
  PROFILE_UPDATE_FAILED: 'Failed to update profile. Please try again.',
  PROFILE_DELETE_FAILED: 'Failed to delete account. Please contact support.',
  
  // General
  UNAUTHORIZED: 'Please log in to continue.',
  NETWORK_ERROR: 'Network error. Please check your connection.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
} as const;

/**
 * Get specific error message with fallback
 */
export const getErrorMessage = (key: keyof typeof ErrorMessages): string => {
  return ErrorMessages[key] || ErrorMessages.UNKNOWN_ERROR;
};
