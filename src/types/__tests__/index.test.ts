/**
 * Type tests to ensure type definitions are correctly exported
 * These tests help prevent accidental breaking changes to type definitions
 */

import { describe, it, expectTypeOf } from 'vitest';
import type {
  Transaction,
  Dispute,
  Profile,
  TransactionStatus,
  DisputeStatus,
  UserType,
  CountryCode,
  Currency,
} from '../index';

describe('Type definitions', () => {
  describe('Transaction', () => {
    it('should have correct structure', () => {
      expectTypeOf<Transaction>().toHaveProperty('id');
      expectTypeOf<Transaction>().toHaveProperty('user_id');
      expectTypeOf<Transaction>().toHaveProperty('buyer_id');
      expectTypeOf<Transaction>().toHaveProperty('title');
      expectTypeOf<Transaction>().toHaveProperty('price');
      expectTypeOf<Transaction>().toHaveProperty('status');
    });

    it('should have correct types for key fields', () => {
      expectTypeOf<Transaction['id']>().toBeString();
      expectTypeOf<Transaction['price']>().toBeNumber();
      expectTypeOf<Transaction['status']>().toMatchTypeOf<TransactionStatus>();
    });
  });

  describe('Dispute', () => {
    it('should have correct structure', () => {
      expectTypeOf<Dispute>().toHaveProperty('id');
      expectTypeOf<Dispute>().toHaveProperty('transaction_id');
      expectTypeOf<Dispute>().toHaveProperty('reporter_id');
      expectTypeOf<Dispute>().toHaveProperty('status');
    });

    it('should have correct types for status', () => {
      expectTypeOf<Dispute['status']>().toMatchTypeOf<DisputeStatus>();
    });
  });

  describe('Profile', () => {
    it('should have correct structure', () => {
      expectTypeOf<Profile>().toHaveProperty('user_id');
      expectTypeOf<Profile>().toHaveProperty('first_name');
      expectTypeOf<Profile>().toHaveProperty('last_name');
      expectTypeOf<Profile>().toHaveProperty('user_type');
      expectTypeOf<Profile>().toHaveProperty('country');
    });

    it('should have correct enum types', () => {
      expectTypeOf<Profile['user_type']>().toMatchTypeOf<UserType>();
      expectTypeOf<Profile['country']>().toMatchTypeOf<CountryCode>();
    });
  });

  describe('Enum types', () => {
    it('should have correct TransactionStatus values', () => {
      expectTypeOf<TransactionStatus>().toEqualTypeOf<
        'pending' | 'pending_date_confirmation' | 'paid' | 'validated' | 'disputed' | 'expired' | 'refunded'
      >();
    });

    it('should have correct Currency values', () => {
      expectTypeOf<Currency>().toEqualTypeOf<'eur' | 'chf' | 'EUR' | 'CHF'>();
    });

    it('should have correct UserType values', () => {
      expectTypeOf<UserType>().toEqualTypeOf<'individual' | 'company' | 'independent'>();
    });
  });
});
