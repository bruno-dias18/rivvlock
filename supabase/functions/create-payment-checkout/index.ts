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

  // Assign buyer from shared link if not set, else enforce ownership
  let effectiveTransaction = transaction;
  if (!transaction.buyer_id) {
    logger.log('[PAYMENT-CHECKOUT] No buyer on transaction, attempting to claim for current user');
    const { data: claimed, error: claimError } = await adminClient!
      .from('transactions')
      .update({
        buyer_id: user!.id,
        client_email: transaction.client_email || user!.email || null,
        buyer_display_name: transaction.buyer_display_name || user!.email || null,
      })
      .eq('id', transactionId)
      .is('buyer_id', null)
      .select('*')
      .single();

    if (claimError || !claimed) {
      logger.error('[PAYMENT-CHECKOUT] Failed to claim transaction', { error: claimError?.message });
      throw new Error('Ce lien de paiement a déjà été revendiqué par un autre acheteur.');
    }

    logger.log('[PAYMENT-CHECKOUT] Transaction successfully claimed by user', { userId: user!.id });
    effectiveTransaction = claimed;
  } else if (transaction.buyer_id !== user!.id) {
    throw new Error('Ce lien de paiement est attribué à un autre acheteur.');
  }

  const sellerId = effectiveTransaction.user_id;

  // Verify buyer has or create Stripe customer
  const { data: buyerProfile } = await adminClient!
    .from('profiles')
    .select('stripe_customer_id')
    .eq('user_id', user!.id)
    .single();

  let customerId = buyerProfile?.stripe_customer_id as string | undefined;

  // Initialize Stripe (needed for customer ops too)
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2024-06-20",
  });

  if (!customerId) {
    // Try to find existing customer by email
    const userEmail = user!.email;
    if (!userEmail) {
      throw new Error('Buyer email is required to create a Stripe customer');
    }
    const existing = await stripe.customers.list({ email: userEmail, limit: 1 });
    if (existing.data.length > 0) {
      customerId = existing.data[0].id;
    } else {
      const created = await stripe.customers.create({ email: userEmail });
      customerId = created.id;
    }
    // Persist on profile for future
    await adminClient!
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('user_id', user!.id);
  }

  // Verify seller has Stripe account
  const { data: sellerAccount } = await adminClient!
    .from('stripe_accounts')
    .select('stripe_account_id')
    .eq('user_id', sellerId)
    .single();

  if (!sellerAccount?.stripe_account_id) {
    throw new Error('Seller must have a configured Stripe account');
  }

  // (Stripe already initialized above)

const amount = Math.round(effectiveTransaction.price * 100);
  const currency = effectiveTransaction.currency.toLowerCase();

  // Use request origin as fallback for redirect URLs
  const origin = req.headers.get("origin") 
    || Deno.env.get("APP_URL") 
    || Deno.env.get("SITE_URL") 
    || "https://app.rivvlock.com";

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency,
        product_data: {
name: effectiveTransaction.title,
          description: effectiveTransaction.description || undefined,
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
        seller_id: sellerId,
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
