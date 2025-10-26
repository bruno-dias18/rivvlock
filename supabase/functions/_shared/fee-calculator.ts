/**
 * Centralized Fee Calculator for RivvLock Platform
 * 
 * This is the SINGLE SOURCE OF TRUTH for all fee calculations across the platform.
 * 
 * ⚠️ CRITICAL: This logic handles real money transfers.
 * DO NOT modify without extensive testing.
 * 
 * Platform Fee Structure:
 * - RivvLock commission: 5% of transaction amount (always)
 * - Seller receives: 95% of transaction amount (before any refunds)
 * - Buyer/Seller split: Configurable via fee_ratio_client (0-100%)
 *   - fee_ratio_client = 0%: Seller pays 100% of fee
 *   - fee_ratio_client = 50%: Split 50/50
 *   - fee_ratio_client = 100%: Buyer pays 100% of fee
 */

/** Platform commission rate (5%) */
export const PLATFORM_FEE_RATE = 0.05;

/** Seller's share of transaction amount (95%) */
export const SELLER_PERCENTAGE = 0.95;

/** RivvLock's commission percentage (5%) */
export const RIVVLOCK_PERCENTAGE = 0.05;

/**
 * Adyen typical processing fees
 * ~1.4% + CHF 0.25 per transaction
 */
export const ADYEN_FEE_PERCENTAGE = 0.014;
export const ADYEN_FIXED_FEE_CENTS = 25;

/**
 * Result of platform fee calculation
 */
export interface PlatformFeeResult {
  /** Total platform fee (5% of amount) */
  totalFee: number;
  /** Portion of fee paid by buyer */
  buyerFee: number;
  /** Portion of fee paid by seller */
  sellerFee: number;
}

/**
 * Result of payout calculation for Adyen transactions
 */
export interface AdyenPayoutCalculation {
  /** Original transaction amount in cents */
  grossAmount: number;
  /** Platform commission (5% of gross) in cents */
  platformCommission: number;
  /** Amount to transfer to seller (95% of gross) in cents */
  sellerAmount: number;
  /** Estimated Adyen processor fees in cents */
  estimatedProcessorFees: number;
  /** Net revenue for RivvLock after processor fees in cents */
  netPlatformRevenue: number;
  /** Net margin percentage */
  netMarginPercent: string;
}

/**
 * Calculate RivvLock platform fees with buyer/seller split
 * 
 * Formula:
 * - totalFee = amount * 5%
 * - buyerFee = totalFee * (feeRatioClient / 100)
 * - sellerFee = totalFee - buyerFee
 * 
 * @param amount - Transaction amount in major currency unit (e.g., CHF, EUR)
 * @param feeRatioClient - Percentage of fee paid by buyer (0-100). Default: 0 (seller pays all)
 * @returns Calculated fee breakdown
 * 
 * @example
 * // Seller pays all fees (default)
 * calculatePlatformFees(100, 0)
 * // => { totalFee: 5.00, buyerFee: 0.00, sellerFee: 5.00 }
 * 
 * @example
 * // 50/50 split
 * calculatePlatformFees(100, 50)
 * // => { totalFee: 5.00, buyerFee: 2.50, sellerFee: 2.50 }
 * 
 * @example
 * // Buyer pays all fees
 * calculatePlatformFees(100, 100)
 * // => { totalFee: 5.00, buyerFee: 5.00, sellerFee: 0.00 }
 */
export function calculatePlatformFees(
  amount: number,
  feeRatioClient: number = 0
): PlatformFeeResult {
  // Validate inputs
  if (amount < 0) {
    throw new Error(`Invalid amount: ${amount}. Must be non-negative.`);
  }
  if (feeRatioClient < 0 || feeRatioClient > 100) {
    throw new Error(`Invalid feeRatioClient: ${feeRatioClient}. Must be between 0 and 100.`);
  }

  const totalFee = amount * PLATFORM_FEE_RATE;
  const buyerFee = totalFee * (feeRatioClient / 100);
  const sellerFee = totalFee - buyerFee;

  return {
    totalFee: Math.round(totalFee),
    buyerFee: Math.round(buyerFee),
    sellerFee: Math.round(sellerFee),
  };
}

/**
 * Calculate Adyen payout amounts with platform commission and processor fees
 * 
 * Formula:
 * 1. grossAmount = transactionPrice * 100 (convert to cents)
 * 2. platformCommission = grossAmount * 5%
 * 3. sellerAmount = grossAmount * 95%
 * 4. estimatedProcessorFees = grossAmount * 1.4% + 25 cents
 * 5. netPlatformRevenue = platformCommission - estimatedProcessorFees
 * 
 * @param transactionPrice - Transaction price in major currency unit (e.g., CHF)
 * @returns Complete payout calculation with all amounts in cents
 * 
 * @example
 * calculateAdyenPayout(100)
 * // => {
 * //   grossAmount: 10000,           // 100 CHF
 * //   platformCommission: 500,      // 5 CHF (5%)
 * //   sellerAmount: 9500,           // 95 CHF (95%)
 * //   estimatedProcessorFees: 165,  // 1.65 CHF (1.4% + 0.25)
 * //   netPlatformRevenue: 335,      // 3.35 CHF (5% - 1.65%)
 * //   netMarginPercent: "3.35"
 * // }
 */
export function calculateAdyenPayout(
  transactionPrice: number
): AdyenPayoutCalculation {
  if (transactionPrice < 0) {
    throw new Error(`Invalid transaction price: ${transactionPrice}. Must be non-negative.`);
  }

  // Convert to cents
  const grossAmount = Math.round(transactionPrice * 100);

  // Platform takes 5%, seller receives 95%
  const platformCommission = Math.round(grossAmount * RIVVLOCK_PERCENTAGE);
  const sellerAmount = Math.round(grossAmount * SELLER_PERCENTAGE);

  // Estimate Adyen processor fees (1.4% + CHF 0.25)
  const estimatedProcessorFees = Math.round(
    grossAmount * ADYEN_FEE_PERCENTAGE + ADYEN_FIXED_FEE_CENTS
  );

  // Net revenue after processor fees
  const netPlatformRevenue = platformCommission - estimatedProcessorFees;
  const netMarginPercent = ((netPlatformRevenue / grossAmount) * 100).toFixed(2);

  return {
    grossAmount,
    platformCommission,
    sellerAmount,
    estimatedProcessorFees,
    netPlatformRevenue,
    netMarginPercent,
  };
}

/**
 * Calculate platform fee for refund scenarios
 * Platform ALWAYS takes 5% of original transaction, regardless of refund amount
 * 
 * @param totalAmountCents - Original transaction amount in cents
 * @returns Platform fee in cents (5% of total)
 * 
 * @example
 * calculatePlatformFeeForRefund(10000)
 * // => 500 (5 CHF, which is 5% of 100 CHF)
 */
export function calculatePlatformFeeForRefund(totalAmountCents: number): number {
  if (totalAmountCents < 0) {
    throw new Error(`Invalid amount: ${totalAmountCents}. Must be non-negative.`);
  }
  return Math.round(totalAmountCents * PLATFORM_FEE_RATE);
}

/**
 * Convert amount to cents (Stripe/Adyen format)
 * 
 * @param amount - Amount in major currency unit
 * @returns Amount in cents
 */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Convert cents to major currency unit
 * 
 * @param cents - Amount in cents
 * @returns Amount in major currency unit
 */
export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Format fee calculation for logging
 * 
 * @param result - Fee calculation result
 * @param currency - Currency code (e.g., 'CHF', 'EUR')
 * @returns Formatted string
 */
export function formatFeeCalculation(
  result: PlatformFeeResult | AdyenPayoutCalculation,
  currency: string = 'CHF'
): string {
  if ('sellerAmount' in result && 'grossAmount' in result) {
    // AdyenPayoutCalculation
    return [
      `Adyen Payout Calculation:`,
      `- Gross Amount: ${fromCents(result.grossAmount).toFixed(2)} ${currency}`,
      `- Platform Commission (5%): ${fromCents(result.platformCommission).toFixed(2)} ${currency}`,
      `- Seller Amount (95%): ${fromCents(result.sellerAmount).toFixed(2)} ${currency}`,
      `- Estimated Processor Fees: ${fromCents(result.estimatedProcessorFees).toFixed(2)} ${currency}`,
      `- Net Platform Revenue: ${fromCents(result.netPlatformRevenue).toFixed(2)} ${currency} (${result.netMarginPercent}%)`,
    ].join('\n');
  } else {
    // PlatformFeeResult
    return [
      `Platform Fee Calculation:`,
      `- Total Fee (5%): ${fromCents(result.totalFee).toFixed(2)} ${currency}`,
      `- Buyer Fee: ${fromCents(result.buyerFee).toFixed(2)} ${currency}`,
      `- Seller Fee: ${fromCents(result.sellerFee).toFixed(2)} ${currency}`,
    ].join('\n');
  }
}
