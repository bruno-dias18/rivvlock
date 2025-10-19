import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { logger } from "../_shared/logger.ts";
import { 
  compose, 
  withCors, 
  withAuth, 
  withRateLimit, 
  withValidation,
  successResponse,
  Handler,
  HandlerContext
} from "../_shared/middleware.ts";

const paymentSchema = z.object({
  transactionId: z.string().uuid(),
});

const handler: Handler = async (req, ctx: HandlerContext) => {
  const { user, adminClient, body } = ctx;
  const { transactionId } = body;

  logger.log('[PAYMENT-CHECKOUT] Starting handler');
  logger.log('[PAYMENT-CHECKOUT] User ID:', user?.id);
  logger.log('[PAYMENT-CHECKOUT] AdminClient defined:', !!adminClient);
  logger.log('[PAYMENT-CHECKOUT] Transaction ID:', transactionId);

  // Get transaction
  logger.log('[PAYMENT-CHECKOUT] Fetching transaction with adminClient');
  const { data: transaction, error: txError } = await adminClient!
    .from('transactions')
    .select('*')
    .eq('id', transactionId)
    .single();

  logger.log('[PAYMENT-CHECKOUT] Transaction query result:', { found: !!transaction, error: txError?.message });

  if (txError || !transaction) {
    logger.error('[PAYMENT-CHECKOUT] Transaction error:', txError);
    throw new Error(`Transaction not found: ${txError?.message || 'Unknown error'}`);
  }

  // Verify user is buyer
  if (transaction.buyer_id !== user!.id) {
    throw new Error('Only the buyer can create a payment');
  }

  // Verify buyer has Stripe customer
  const { data: buyerProfile } = await adminClient!
    .from('profiles')
    .select('stripe_customer_id')
    .eq('user_id', user!.id)
    .single();

  if (!buyerProfile?.stripe_customer_id) {
    throw new Error('Buyer must have a Stripe customer ID');
  }

  // Verify seller has Stripe account
  const { data: sellerAccount } = await adminClient!
    .from('stripe_accounts')
    .select('stripe_account_id')
    .eq('user_id', transaction.user_id)
    .single();

  if (!sellerAccount?.stripe_account_id) {
    throw new Error('Seller must have a configured Stripe account');
  }

  // Initialize Stripe
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  const amount = Math.round(transaction.price * 100);
  const currency = transaction.currency.toLowerCase();

  // Use request origin as fallback for redirect URLs
  const origin = req.headers.get("origin") 
    || Deno.env.get("APP_URL") 
    || Deno.env.get("SITE_URL") 
    || "https://app.rivvlock.com";

  // Create Checkout Session
  const session = await stripe.checkout.sessions.create({
    customer: buyerProfile.stripe_customer_id,
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency,
        product_data: {
          name: transaction.title,
          description: transaction.description || undefined,
        },
        unit_amount: amount,
      },
      quantity: 1,
    }],
    mode: 'payment',
    payment_intent_data: {
      capture_method: 'manual',
      metadata: {
        transaction_id: transactionId,
        seller_id: transaction.user_id,
        buyer_id: user!.id,
      },
    },
    success_url: `${origin}/payment-success?transaction_id=${transactionId}`,
    cancel_url: `${origin}/transactions?tab=pending`,
  });

  logger.log('[PAYMENT-CHECKOUT] Session created:', session.id);

  return successResponse({ 
    session_id: session.id,
    session_url: session.url,
    url: session.url,
    sessionUrl: session.url
  });
};

const composedHandler = compose(
  withCors,
  withAuth,
  withRateLimit(),
  withValidation(paymentSchema)
)(handler);

serve(composedHandler);
