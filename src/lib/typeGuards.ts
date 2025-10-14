/**
 * Type guards and runtime type checking utilities
 * Provides strict type safety beyond TypeScript compile-time checks
 */

import type { Transaction, Dispute, Profile, Currency } from '@/types';

/**
 * Check if value is a valid transaction status
 */
export const isTransactionStatus = (status: string): status is Transaction['status'] => {
  return ['pending', 'paid', 'validated', 'disputed', 'expired'].includes(status);
};

/**
 * Check if value is a valid dispute status
 */
export const isDisputeStatus = (status: string): status is Dispute['status'] => {
  return ['open', 'negotiating', 'responded', 'escalated', 'resolved', 'resolved_refund', 'resolved_release'].includes(status);
};

/**
 * Check if value is a valid currency
 */
export const isCurrency = (currency: string): currency is Currency => {
  return ['eur', 'chf'].includes(currency);
};

/**
 * Type guard for checking if error is a Supabase error
 */
export const isSupabaseError = (error: any): error is { message: string; code?: string; details?: string } => {
  return error && typeof error === 'object' && 'message' in error;
};

/**
 * Check if transaction belongs to user (seller or buyer)
 */
export const userOwnsTransaction = (
  transaction: Transaction | null | undefined,
  userId: string | undefined
): boolean => {
  if (!transaction || !userId) return false;
  return transaction.user_id === userId || transaction.buyer_id === userId;
};

/**
 * Check if user is seller of transaction
 */
export const userIsSeller = (
  transaction: Transaction | null | undefined,
  userId: string | undefined
): boolean => {
  if (!transaction || !userId) return false;
  return transaction.user_id === userId;
};

/**
 * Check if user is buyer of transaction
 */
export const userIsBuyer = (
  transaction: Transaction | null | undefined,
  userId: string | undefined
): boolean => {
  if (!transaction || !userId) return false;
  return transaction.buyer_id === userId;
};

/**
 * Check if transaction can be disputed
 */
export const canDisputeTransaction = (transaction: Transaction | null | undefined): boolean => {
  if (!transaction) return false;
  return transaction.status === 'paid' || transaction.status === 'validated';
};

/**
 * Check if transaction can be completed (validated)
 */
export const canCompleteTransaction = (
  transaction: Transaction | null | undefined,
  userIsBuyer: boolean
): boolean => {
  if (!transaction || !userIsBuyer) return false;
  return transaction.status === 'paid' && !transaction.buyer_validated_at;
};

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate UUID format
 */
export const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * Assert that value is not null or undefined
 */
export function assertDefined<T>(value: T | null | undefined, name: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(`${name} is required but was ${value}`);
  }
}

/**
 * Narrow type from unknown to typed object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
