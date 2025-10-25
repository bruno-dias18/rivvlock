import Stripe from "https://esm.sh/stripe@14.21.0";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { logger } from "./logger.ts";

/**
 * Validates a Stripe account and updates the database with latest status
 * 
 * @param stripe - Stripe instance
 * @param adminClient - Supabase admin client
 * @param userId - User ID in our database
 * @param stripeAccountId - Stripe Connect account ID
 * @returns Object with isActive boolean and Stripe account details
 * 
 * @example
 * ```typescript
 * const { isActive, account } = await validateAndUpdateStripeAccount(
 *   stripe,
 *   adminClient,
 *   transaction.user_id,
 *   sellerStripeAccount.stripe_account_id
 * );
 * 
 * if (!isActive) {
 *   throw new Error("Seller Stripe account is not active");
 * }
 * ```
 */
export async function validateAndUpdateStripeAccount(
  stripe: Stripe,
  adminClient: SupabaseClient,
  userId: string,
  stripeAccountId: string
): Promise<{ isActive: boolean; account: Stripe.Account }> {
  
  try {
    // LIVE verification on Stripe API
    const account = await stripe.accounts.retrieve(stripeAccountId);
    
    logger.log(`[STRIPE-VALIDATOR] Account validated live`, {
      accountId: stripeAccountId,
      payoutsEnabled: account.payouts_enabled,
      chargesEnabled: account.charges_enabled
    });
    
    // Determine if account is fully active
    const isActive = !!(account.payouts_enabled && account.charges_enabled);
    
    // Update database with latest status
    await adminClient
      .from('stripe_accounts')
      .update({
        account_status: isActive ? 'active' : 'pending',
        payouts_enabled: account.payouts_enabled || false,
        charges_enabled: account.charges_enabled || false,
        last_status_check: new Date().toISOString(),
      })
      .eq('user_id', userId);
    
    return { isActive, account };
    
  } catch (stripeError: any) {
    const code = stripeError?.code || stripeError?.raw?.code;
    const status = stripeError?.statusCode || stripeError?.raw?.statusCode;
    const message = String(stripeError?.message || '');
    const isMissing = code === 'resource_missing' || status === 404 || /No such account/i.test(message);
    
    logger.log(`[STRIPE-VALIDATOR] Validation failed`, {
      accountId: stripeAccountId,
      code,
      status,
      message
    });
    
    // If account doesn't exist on Stripe, mark as inactive
    if (isMissing) {
      await adminClient
        .from('stripe_accounts')
        .update({
          account_status: 'inactive',
          payouts_enabled: false,
          charges_enabled: false,
          last_status_check: new Date().toISOString(),
        })
        .eq('user_id', userId);
    }
    
    // Re-throw error for caller to handle
    throw stripeError;
  }
}
