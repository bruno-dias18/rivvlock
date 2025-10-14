import { describe, it, expect, vi } from 'vitest';
import { getUserFriendlyError, getErrorMessage, ErrorMessages } from '../errorMessages';

// Mock i18n
vi.mock('@/i18n/config', () => ({
  default: {
    t: (key: string, options?: any) => options?.defaultValue || key,
  },
}));

describe('errorMessages', () => {
  describe('getUserFriendlyError', () => {
    it('should handle authentication errors', () => {
      const error = { code: 'invalid_credentials', message: 'Invalid login credentials' };
      const message = getUserFriendlyError(error);

      expect(message).toContain('Invalid email or password');
    });

    it('should handle email not confirmed error', () => {
      const error = { code: 'email_not_confirmed' };
      const message = getUserFriendlyError(error);

      expect(message).toContain('verify your email');
    });

    it('should handle user not found error', () => {
      const error = { code: 'user_not_found' };
      const message = getUserFriendlyError(error);

      expect(message).toContain('No account found');
    });

    it('should handle Stripe payment errors', () => {
      const error = { message: 'stripe card_declined error' };
      const message = getUserFriendlyError(error);

      expect(message).toContain('card was declined');
    });

    it('should handle insufficient funds error', () => {
      const error = { message: 'insufficient_funds on payment' };
      const message = getUserFriendlyError(error);

      expect(message).toContain('Insufficient funds');
    });

    it('should handle payment intent errors', () => {
      const error = { message: 'payment_intent failed' };
      const message = getUserFriendlyError(error);

      expect(message).toContain('Payment processing failed');
    });

    it('should handle network errors', () => {
      const error = { message: 'Failed to fetch' };
      const message = getUserFriendlyError(error);

      expect(message).toContain('Connection failed');
    });

    it('should handle timeout errors', () => {
      const error = { statusCode: 408 };
      const message = getUserFriendlyError(error, { statusCode: 408 });

      expect(message).toContain('timed out');
    });

    it('should handle database not found errors', () => {
      const error = { code: 'PGRST116' };
      const message = getUserFriendlyError(error);

      expect(message).toContain('not found');
    });

    it('should handle constraint errors', () => {
      const error = { code: '23505', message: 'constraint violation' };
      const message = getUserFriendlyError(error);

      expect(message).toContain('database constraints');
    });

    it('should handle validation errors', () => {
      const error = { message: 'validation failed for field' };
      const message = getUserFriendlyError(error);

      expect(message).toContain('Invalid input');
    });

    it('should handle permission errors', () => {
      const error = { statusCode: 403 };
      const message = getUserFriendlyError(error, { statusCode: 403 });

      expect(message).toContain('permission');
    });

    it('should handle rate limiting errors', () => {
      const error = { statusCode: 429 };
      const message = getUserFriendlyError(error, { statusCode: 429 });

      expect(message).toContain('Too many requests');
    });

    it('should handle server errors', () => {
      const error = { statusCode: 500 };
      const message = getUserFriendlyError(error, { statusCode: 500 });

      expect(message).toContain('Server error');
    });

    it('should provide default fallback for unknown errors', () => {
      const error = { message: 'Some random unknown error' };
      const message = getUserFriendlyError(error);

      expect(message).toContain('unexpected error');
    });

    it('should handle string errors', () => {
      const error = 'Simple error string';
      const message = getUserFriendlyError(error);

      expect(message).toBeDefined();
      expect(typeof message).toBe('string');
    });

    it('should handle errors without message', () => {
      const error = {};
      const message = getUserFriendlyError(error);

      expect(message).toContain('unexpected error');
    });
  });

  describe('getErrorMessage', () => {
    it('should return correct transaction error messages', () => {
      expect(getErrorMessage('TRANSACTION_CREATE_FAILED')).toContain('Failed to create transaction');
      expect(getErrorMessage('TRANSACTION_NOT_FOUND')).toContain('Transaction not found');
      expect(getErrorMessage('TRANSACTION_EXPIRED')).toContain('expired');
    });

    it('should return correct dispute error messages', () => {
      expect(getErrorMessage('DISPUTE_CREATE_FAILED')).toContain('Failed to create dispute');
      expect(getErrorMessage('DISPUTE_NOT_IN_VALIDATION')).toContain('validation period');
    });

    it('should return correct Stripe error messages', () => {
      expect(getErrorMessage('STRIPE_ACCOUNT_NOT_SETUP')).toContain('Stripe account');
      expect(getErrorMessage('STRIPE_PAYMENT_FAILED')).toContain('Payment processing failed');
    });

    it('should return correct admin error messages', () => {
      expect(getErrorMessage('ADMIN_ACCESS_DENIED')).toContain('Admin access');
    });

    it('should return correct profile error messages', () => {
      expect(getErrorMessage('PROFILE_UPDATE_FAILED')).toContain('Failed to update profile');
    });

    it('should return correct general error messages', () => {
      expect(getErrorMessage('UNAUTHORIZED')).toContain('log in');
      expect(getErrorMessage('NETWORK_ERROR')).toContain('Network error');
      expect(getErrorMessage('UNKNOWN_ERROR')).toContain('unexpected error');
    });

    it('should fallback to UNKNOWN_ERROR for invalid keys', () => {
      const message = getErrorMessage('INVALID_KEY' as any);
      expect(message).toBe(ErrorMessages.UNKNOWN_ERROR);
    });
  });

  describe('ErrorMessages constants', () => {
    it('should have all expected error message keys', () => {
      expect(ErrorMessages).toHaveProperty('TRANSACTION_CREATE_FAILED');
      expect(ErrorMessages).toHaveProperty('DISPUTE_CREATE_FAILED');
      expect(ErrorMessages).toHaveProperty('STRIPE_PAYMENT_FAILED');
      expect(ErrorMessages).toHaveProperty('ADMIN_ACCESS_DENIED');
      expect(ErrorMessages).toHaveProperty('UNKNOWN_ERROR');
    });

    it('should have non-empty error messages', () => {
      Object.values(ErrorMessages).forEach((message) => {
        expect(message).toBeTruthy();
        expect(message.length).toBeGreaterThan(0);
      });
    });
  });
});
