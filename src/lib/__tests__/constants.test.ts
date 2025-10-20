/**
 * Tests for application constants
 * Validates that all constants are properly defined and have correct values
 */

import { describe, it, expect } from 'vitest';
import {
  STORAGE_KEYS,
  TIME,
  QUERY_CONFIG,
  PAGINATION,
  TRANSACTION_LIMITS,
  FEES,
  TRANSACTION_STATUS,
  DISPUTE_STATUS,
} from '../constants';

describe('Constants', () => {
  describe('STORAGE_KEYS', () => {
    it('should have all required storage keys', () => {
      expect(STORAGE_KEYS.TRANSACTIONS_SORT).toBe('rivvlock-transactions-sort');
      expect(STORAGE_KEYS.LAST_SEEN).toBe('last_seen');
      expect(STORAGE_KEYS.LANGUAGE).toBe('i18nextLng');
    });
  });

  describe('TIME', () => {
    it('should have correct time constants in milliseconds', () => {
      expect(TIME.ONE_SECOND).toBe(1000);
      expect(TIME.ONE_MINUTE).toBe(60 * 1000);
      expect(TIME.ONE_HOUR).toBe(60 * 60 * 1000);
      expect(TIME.ONE_DAY).toBe(24 * 60 * 60 * 1000);
    });

    it('should have correct deadline durations', () => {
      expect(TIME.PAYMENT_DEADLINE).toBe(48 * 60 * 60 * 1000); // 48 hours
      expect(TIME.VALIDATION_DEADLINE).toBe(72 * 60 * 60 * 1000); // 72 hours
      expect(TIME.DISPUTE_DEADLINE).toBe(7 * 24 * 60 * 60 * 1000); // 7 days
    });
  });

  describe('QUERY_CONFIG', () => {
    it('should have proper React Query configuration', () => {
      expect(QUERY_CONFIG.STALE_TIME).toBeGreaterThan(0);
      expect(QUERY_CONFIG.GC_TIME).toBeGreaterThan(QUERY_CONFIG.STALE_TIME);
      expect(QUERY_CONFIG.MAX_RETRIES).toBeGreaterThan(0);
    });
  });

  describe('PAGINATION', () => {
    it('should have valid pagination limits', () => {
      expect(PAGINATION.DEFAULT_PAGE_SIZE).toBe(20);
      expect(PAGINATION.MAX_PAGE_SIZE).toBeGreaterThan(PAGINATION.DEFAULT_PAGE_SIZE);
    });
  });

  describe('TRANSACTION_LIMITS', () => {
    it('should have valid transaction limits', () => {
      expect(TRANSACTION_LIMITS.MIN_AMOUNT).toBeGreaterThan(0);
      expect(TRANSACTION_LIMITS.MAX_AMOUNT).toBeGreaterThan(TRANSACTION_LIMITS.MIN_AMOUNT);
      expect(TRANSACTION_LIMITS.MAX_RENEWALS).toBeGreaterThan(0);
    });
  });

  describe('FEES', () => {
    it('should have correct platform fee rate', () => {
      expect(FEES.RIVVLOCK_FEE_RATE).toBe(0.05); // 5%
      expect(FEES.RIVVLOCK_FEE_RATE).toBeGreaterThan(0);
      expect(FEES.RIVVLOCK_FEE_RATE).toBeLessThan(1);
    });
  });

  describe('Status enums', () => {
    it('should have all transaction statuses', () => {
      expect(TRANSACTION_STATUS.PENDING).toBe('pending');
      expect(TRANSACTION_STATUS.PAID).toBe('paid');
      expect(TRANSACTION_STATUS.VALIDATED).toBe('validated');
      expect(TRANSACTION_STATUS.DISPUTED).toBe('disputed');
      expect(TRANSACTION_STATUS.EXPIRED).toBe('expired');
    });

    it('should have all dispute statuses', () => {
      expect(DISPUTE_STATUS.OPEN).toBe('open');
      expect(DISPUTE_STATUS.NEGOTIATING).toBe('negotiating');
      expect(DISPUTE_STATUS.ESCALATED).toBe('escalated');
      expect(DISPUTE_STATUS.RESOLVED).toBe('resolved');
    });
  });
});
