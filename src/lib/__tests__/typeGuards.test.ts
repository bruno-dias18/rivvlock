import { describe, it, expect } from 'vitest';
import {
  isTransactionStatus,
  isDisputeStatus,
  isCurrency,
  isSupabaseError,
  userOwnsTransaction,
  userIsSeller,
  userIsBuyer,
  canDisputeTransaction,
  canCompleteTransaction,
  isValidEmail,
  isValidUUID,
  assertDefined,
  isObject,
} from '../typeGuards';
import type { Transaction } from '@/types';

describe('typeGuards', () => {
  describe('isTransactionStatus', () => {
    it('should validate transaction statuses', () => {
      expect(isTransactionStatus('pending')).toBe(true);
      expect(isTransactionStatus('paid')).toBe(true);
      expect(isTransactionStatus('validated')).toBe(true);
      expect(isTransactionStatus('disputed')).toBe(true);
      expect(isTransactionStatus('expired')).toBe(true);
      expect(isTransactionStatus('invalid')).toBe(false);
    });
  });

  describe('isDisputeStatus', () => {
    it('should validate dispute statuses', () => {
      expect(isDisputeStatus('open')).toBe(true);
      expect(isDisputeStatus('negotiating')).toBe(true);
      expect(isDisputeStatus('responded')).toBe(true);
      expect(isDisputeStatus('escalated')).toBe(true);
      expect(isDisputeStatus('resolved')).toBe(true);
      expect(isDisputeStatus('resolved_refund')).toBe(true);
      expect(isDisputeStatus('resolved_release')).toBe(true);
      expect(isDisputeStatus('invalid')).toBe(false);
    });
  });

  describe('isCurrency', () => {
    it('should validate currencies', () => {
      expect(isCurrency('eur')).toBe(true);
      expect(isCurrency('chf')).toBe(true);
      expect(isCurrency('usd')).toBe(false);
    });
  });

  describe('isSupabaseError', () => {
    it('should identify Supabase errors', () => {
      expect(isSupabaseError({ message: 'Error' })).toBe(true);
      expect(isSupabaseError({ message: 'Error', code: '123' })).toBe(true);
      expect(isSupabaseError({})).toBe(false);
      expect(isSupabaseError(null)).toBe(false);
      expect(isSupabaseError('string')).toBe(false);
    });
  });

  describe('userOwnsTransaction', () => {
    const mockTransaction: Partial<Transaction> = {
      id: 'txn-1',
      user_id: 'seller-id',
      buyer_id: 'buyer-id',
    };

    it('should return true if user is seller', () => {
      expect(userOwnsTransaction(mockTransaction as Transaction, 'seller-id')).toBe(true);
    });

    it('should return true if user is buyer', () => {
      expect(userOwnsTransaction(mockTransaction as Transaction, 'buyer-id')).toBe(true);
    });

    it('should return false if user is neither seller nor buyer', () => {
      expect(userOwnsTransaction(mockTransaction as Transaction, 'other-user')).toBe(false);
    });

    it('should return false if transaction is null', () => {
      expect(userOwnsTransaction(null, 'user-id')).toBe(false);
    });

    it('should return false if userId is undefined', () => {
      expect(userOwnsTransaction(mockTransaction as Transaction, undefined)).toBe(false);
    });
  });

  describe('userIsSeller', () => {
    const mockTransaction: Partial<Transaction> = {
      id: 'txn-1',
      user_id: 'seller-id',
      buyer_id: 'buyer-id',
    };

    it('should return true if user is seller', () => {
      expect(userIsSeller(mockTransaction as Transaction, 'seller-id')).toBe(true);
    });

    it('should return false if user is not seller', () => {
      expect(userIsSeller(mockTransaction as Transaction, 'buyer-id')).toBe(false);
    });
  });

  describe('userIsBuyer', () => {
    const mockTransaction: Partial<Transaction> = {
      id: 'txn-1',
      user_id: 'seller-id',
      buyer_id: 'buyer-id',
    };

    it('should return true if user is buyer', () => {
      expect(userIsBuyer(mockTransaction as Transaction, 'buyer-id')).toBe(true);
    });

    it('should return false if user is not buyer', () => {
      expect(userIsBuyer(mockTransaction as Transaction, 'seller-id')).toBe(false);
    });
  });

  describe('canDisputeTransaction', () => {
    it('should return true for paid transactions', () => {
      const transaction = { status: 'paid' } as Transaction;
      expect(canDisputeTransaction(transaction)).toBe(true);
    });

    it('should return true for validated transactions', () => {
      const transaction = { status: 'validated' } as Transaction;
      expect(canDisputeTransaction(transaction)).toBe(true);
    });

    it('should return false for pending transactions', () => {
      const transaction = { status: 'pending' } as Transaction;
      expect(canDisputeTransaction(transaction)).toBe(false);
    });

    it('should return false for null transaction', () => {
      expect(canDisputeTransaction(null)).toBe(false);
    });
  });

  describe('canCompleteTransaction', () => {
    it('should return true for paid transaction when user is buyer', () => {
      const transaction = { status: 'paid', buyer_validated_at: null } as Transaction;
      expect(canCompleteTransaction(transaction, true)).toBe(true);
    });

    it('should return false if user is not buyer', () => {
      const transaction = { status: 'paid' } as Transaction;
      expect(canCompleteTransaction(transaction, false)).toBe(false);
    });

    it('should return false if transaction is not paid', () => {
      const transaction = { status: 'pending' } as Transaction;
      expect(canCompleteTransaction(transaction, true)).toBe(false);
    });

    it('should return false if already validated', () => {
      const transaction = { status: 'paid', buyer_validated_at: new Date().toISOString() } as Transaction;
      expect(canCompleteTransaction(transaction, true)).toBe(false);
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct email formats', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('user+tag@example.com')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('invalid@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('invalid@.com')).toBe(false);
    });
  });

  describe('isValidUUID', () => {
    it('should validate correct UUID v4 format', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isValidUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(false); // UUID v1
    });

    it('should reject invalid UUID formats', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false);
      expect(isValidUUID('')).toBe(false);
    });
  });

  describe('assertDefined', () => {
    it('should not throw for defined values', () => {
      expect(() => assertDefined('value', 'testValue')).not.toThrow();
      expect(() => assertDefined(0, 'testValue')).not.toThrow();
      expect(() => assertDefined(false, 'testValue')).not.toThrow();
    });

    it('should throw for null', () => {
      expect(() => assertDefined(null, 'testValue')).toThrow('testValue is required but was null');
    });

    it('should throw for undefined', () => {
      expect(() => assertDefined(undefined, 'testValue')).toThrow('testValue is required but was undefined');
    });
  });

  describe('isObject', () => {
    it('should return true for objects', () => {
      expect(isObject({})).toBe(true);
      expect(isObject({ key: 'value' })).toBe(true);
    });

    it('should return false for non-objects', () => {
      expect(isObject(null)).toBe(false);
      expect(isObject(undefined)).toBe(false);
      expect(isObject('string')).toBe(false);
      expect(isObject(123)).toBe(false);
      expect(isObject([])).toBe(false);
      expect(isObject(true)).toBe(false);
    });
  });
});
