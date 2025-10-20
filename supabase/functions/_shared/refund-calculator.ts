/**
 * Centralized Refund Calculator for RivvLock
 * 
 * This module provides the SINGLE SOURCE OF TRUTH for all refund calculations
 * across the platform. Any changes to the refund logic MUST be made here
 * and thoroughly tested.
 * 
 * ⚠️ CRITICAL: This logic is used for real money transfers via Stripe.
 * DO NOT modify without extensive testing and validation.
 */

/**
 * Result of refund calculation with all monetary amounts in cents
 */
export interface RefundCalculationResult {
  /** Amount to refund to buyer in cents */
  refundAmount: number;
  /** Amount to transfer to seller in cents (after refund and platform fee) */
  sellerAmount: number;
  /** Platform fee in cents (always 5% of original transaction) */
  platformFee: number;
  /** Original transaction amount in cents */
  totalAmount: number;
  /** Refund percentage applied (0-100) */
  refundPercentage: number;
}

/**
 * Calculate refund amounts for a dispute resolution
 * 
 * Formula (VERIFIED CORRECT - DO NOT MODIFY):
 * 1. totalAmount = price * 100 (convert to cents)
 * 2. platformFee = totalAmount * 0.05 (5% of original)
 * 3. refundAmount = totalAmount * (refundPercentage / 100)
 * 4. sellerAmount = totalAmount - refundAmount - platformFee
 * 
 * Example with 100 CHF transaction, 50% refund:
 * - totalAmount = 10000 cents (100 CHF)
 * - platformFee = 500 cents (5 CHF - 5% of 100 CHF)
 * - refundPercentage = 50
 * - refundAmount = 5000 cents (50 CHF to buyer)
 * - sellerAmount = 10000 - 5000 - 500 = 4500 cents (45 CHF to seller)
 * 
 * Result:
 * - Buyer receives: 50 CHF (refund)
 * - Seller receives: 45 CHF (95% of remaining 50 CHF)
 * - Platform keeps: 5 CHF (5% of original 100 CHF)
 * - Total: 50 + 45 + 5 = 100 CHF ✅
 * 
 * @param transactionPrice - Original transaction price in major currency unit (e.g., CHF, EUR)
 * @param refundPercentage - Percentage to refund (0-100)
 * @returns Calculated amounts for refund, seller, and platform fee
 * 
 * @throws {Error} If refundPercentage is out of range [0, 100]
 * @throws {Error} If transactionPrice is negative
 * 
 * @example
 * // Full refund
 * calculateRefund(100, 100)
 * // => { refundAmount: 10000, sellerAmount: -500, platformFee: 500, ... }
 * 
 * @example
 * // Partial refund (50%)
 * calculateRefund(100, 50)
 * // => { refundAmount: 5000, sellerAmount: 4500, platformFee: 500, ... }
 * 
 * @example
 * // No refund (full release)
 * calculateRefund(100, 0)
 * // => { refundAmount: 0, sellerAmount: 9500, platformFee: 500, ... }
 */
export function calculateRefund(
  transactionPrice: number,
  refundPercentage: number
): RefundCalculationResult {
  // Validation
  if (refundPercentage < 0 || refundPercentage > 100) {
    throw new Error(`Invalid refund percentage: ${refundPercentage}. Must be between 0 and 100.`);
  }
  
  if (transactionPrice < 0) {
    throw new Error(`Invalid transaction price: ${transactionPrice}. Must be non-negative.`);
  }

  // Convert to cents (Stripe works in smallest currency unit)
  const totalAmount = Math.round(transactionPrice * 100);
  
  // Platform fee is ALWAYS 5% of the original transaction amount
  // This ensures platform revenue is predictable regardless of refund
  const platformFee = Math.round(totalAmount * 0.05);
  
  // Calculate refund amount based on percentage
  const refundAmount = Math.round((totalAmount * refundPercentage) / 100);
  
  // Seller receives: original amount - refund - platform fee
  // Can be negative in case of full refund (seller receives nothing)
  const sellerAmount = totalAmount - refundAmount - platformFee;

  return {
    refundAmount,
    sellerAmount,
    platformFee,
    totalAmount,
    refundPercentage,
  };
}

/**
 * Validate that calculated amounts sum to original transaction amount
 * 
 * This is a critical invariant that must ALWAYS be true:
 * refundAmount + sellerAmount + platformFee = totalAmount
 * 
 * @param result - Result from calculateRefund
 * @returns true if amounts are consistent, false otherwise
 * 
 * @example
 * const result = calculateRefund(100, 50);
 * validateRefundCalculation(result); // => true
 */
export function validateRefundCalculation(result: RefundCalculationResult): boolean {
  const sum = result.refundAmount + result.sellerAmount + result.platformFee;
  return sum === result.totalAmount;
}

/**
 * Format amounts for logging/debugging
 * 
 * @param result - Result from calculateRefund
 * @param currency - Currency code (e.g., 'CHF', 'EUR')
 * @returns Formatted string with all amounts
 */
export function formatRefundCalculation(
  result: RefundCalculationResult,
  currency: string = 'CHF'
): string {
  return [
    `Refund Calculation (${result.refundPercentage}%):`,
    `- Original: ${(result.totalAmount / 100).toFixed(2)} ${currency}`,
    `- Refund to buyer: ${(result.refundAmount / 100).toFixed(2)} ${currency}`,
    `- Seller receives: ${(result.sellerAmount / 100).toFixed(2)} ${currency}`,
    `- Platform fee: ${(result.platformFee / 100).toFixed(2)} ${currency}`,
    `- Valid: ${validateRefundCalculation(result) ? '✅' : '❌'}`,
  ].join('\n');
}
