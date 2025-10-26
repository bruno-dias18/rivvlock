import Stripe from 'https://esm.sh/stripe@17.5.0';
import {
  calculatePlatformFees as calculatePlatformFeesCore,
  toCents,
  fromCents,
  type PlatformFeeResult,
} from './fee-calculator.ts';

/**
 * Creates a Stripe client instance
 * ⚠️ API Version locked to 2024-06-20 per STRIPE_STABILITY_RULES.md
 */
export function createStripeClient() {
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) {
    throw new Error('STRIPE_SECRET_KEY not configured');
  }
  return new Stripe(stripeKey, {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
  });
}

/**
 * Calculates RivvLock platform fees
 * 
 * @deprecated Use fee-calculator.ts for centralized fee calculations
 * This function is kept for backward compatibility only
 */
export function calculatePlatformFees(amount: number, feeRatioClient: number = 0): PlatformFeeResult {
  return calculatePlatformFeesCore(amount, feeRatioClient);
}

/**
 * Converts amount to Stripe format (cents)
 */
export function toStripeAmount(amount: number): number {
  return toCents(amount);
}

/**
 * Converts Stripe amount to decimal
 */
export function fromStripeAmount(amount: number): number {
  return fromCents(amount);
}
