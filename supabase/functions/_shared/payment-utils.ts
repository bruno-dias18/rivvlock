import Stripe from 'https://esm.sh/stripe@17.5.0';

/**
 * Creates a Stripe client instance
 */
export function createStripeClient() {
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) {
    throw new Error('STRIPE_SECRET_KEY not configured');
  }
  return new Stripe(stripeKey, {
    apiVersion: '2024-11-20.acacia',
    httpClient: Stripe.createFetchHttpClient(),
  });
}

/**
 * Calculates RivvLock platform fees
 */
export function calculatePlatformFees(amount: number, feeRatioClient: number = 0) {
  const PLATFORM_FEE_RATE = 0.05; // 5%
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
 * Converts amount to Stripe format (cents)
 */
export function toStripeAmount(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Converts Stripe amount to decimal
 */
export function fromStripeAmount(amount: number): number {
  return amount / 100;
}
