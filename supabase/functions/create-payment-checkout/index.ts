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
  errorResponse,
  Handler, 
  HandlerContext 
} from "../_shared/middleware.ts";

/**
 * Validation schema for checkout session creation
 */
const schema = z.object({
  transactionId: z.string().uuid(),
  transactionToken: z.string().optional(),
  payment_method: z.string().optional(),
});

/**
 * Create Stripe Checkout Session with escrow configuration
 * 
 * This creates a Stripe Checkout Session (hosted payment page):
 * - Supports card payments (always)
 * - Supports SEPA Direct Debit (if deadline >= 72 hours)
 * - Uses manual capture for escrow
 * - Returns redirect URL to Stripe Checkout
 * 
 * Option C Implementation:
 * - Manual bank transfer: User sees instructions (NOT via Stripe)
 * - SEPA Direct Debit: Automated via Stripe Checkout (if deadline allows)
 * - Card: Standard Stripe card payment
 * - Future: QR codes can be added as another payment_method_type
 * 
 * @param {Request} req - HTTP request
 * @param {HandlerContext} ctx - Context with user, clients, and validated body
 * @returns {Promise<Response>} Success with checkout URL or error
 */
const handler: Handler = async (req, ctx: HandlerContext) => {
  const { user, adminClient, body } = ctx;
  const { transactionId, transactionToken } = body;
  
  try {
    logger.log("🔍 [CREATE-CHECKOUT] Creating checkout session for transaction:", transactionId);
    logger.log("✅ [CREATE-CHECKOUT] User authenticated:", user!.id);

    // Get transaction details
    const { data: transaction, error: transactionError } = await adminClient!
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (transactionError || !transaction) {
      logger.error("❌ [CREATE-CHECKOUT] Transaction not found:", transactionError);
      return errorResponse("Transaction not found", 404);
    }

    // Verify user is the buyer
    if (transaction.buyer_id !== user!.id) {
      logger.error("❌ [CREATE-CHECKOUT] User is not the buyer");
      return errorResponse("Only the buyer can create checkout session", 403);
    }

    // Verify transaction is in pending state
    if (transaction.status !== 'pending') {
      logger.error("❌ [CREATE-CHECKOUT] Transaction is not available for payment");
      return errorResponse("Transaction is not available for payment", 400);
    }

    logger.log("✅ [CREATE-CHECKOUT] Transaction found, buyer verified");

    // Calculate time until payment deadline
    const paymentDeadline = transaction.payment_deadline 
      ? new Date(transaction.payment_deadline) 
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const timeUntilDeadline = paymentDeadline.getTime() - now.getTime();
    const hoursUntilDeadline = timeUntilDeadline / (1000 * 60 * 60);
    
    logger.log(`⏰ [CREATE-CHECKOUT] Payment deadline: ${paymentDeadline.toISOString()}, hours until: ${hoursUntilDeadline.toFixed(2)}`);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-06-20",
    });

    // Get buyer profile to check for existing Stripe customer
    const { data: buyerProfile } = await adminClient!
      .from("profiles")
      .select("stripe_customer_id, email")
      .eq("user_id", user!.id)
      .single();

    logger.log("✅ [CREATE-CHECKOUT] Buyer profile found:", buyerProfile?.stripe_customer_id ? "with Stripe customer" : "without Stripe customer");

    /**
     * OPTION C: Payment Method Configuration
     * 
     * 1. Manual Bank Transfer (VIA Stripe Customer Balance):
     *    - User selects "bank_transfer" in frontend
     *    - Shows BankTransferInstructions with Stripe virtual IBAN
     *    - Funds arrive on Stripe → escrow enabled
     *    - ⚠️ Requires 72h deadline (1-3 days for transfer)
     * 
     * 2. Stripe Checkout (this function):
     *    - Card: Always available
     *    - SEPA Direct Debit: Only if deadline >= 72 hours
     *    - Twint (CHF only): Requires separate session (automatic capture)
     * 
     * CRITICAL: Twint cannot be mixed with other payment methods in same session
     * because it requires automatic capture while others use manual capture for escrow.
     * 
     * Future: QR codes can be added here as payment_method_types
     */
    
    const { payment_method } = body;
    const currency = transaction.currency.toLowerCase();
    let paymentMethodTypes: string[] = [];
    let isTwintSession = false;
    
    // Determine payment methods based on user's choice
    if (payment_method === 'twint' && currency === 'chf') {
      // Twint requires its own session with automatic capture
      paymentMethodTypes = ['twint'];
      isTwintSession = true;
      logger.log("✅ [CREATE-CHECKOUT] Creating Twint-only session (automatic capture)");
    } else {
      // Standard session with manual capture for escrow
      paymentMethodTypes = ['card'];
      
      // Add SEPA Direct Debit if deadline allows
      if (hoursUntilDeadline >= 72) {
        paymentMethodTypes.push('sepa_debit');
        logger.log("✅ [CREATE-CHECKOUT] SEPA Direct Debit available (deadline > 3 days)");
      } else {
        logger.log("⚠️ [CREATE-CHECKOUT] SEPA Direct Debit not available (deadline < 3 days)");
      }
    }

    // Determine success/cancel URLs
    const origin = req.headers.get("origin") || 'https://slthyxqruhfuyfmextwr.supabase.co';
    const successUrl = `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = transactionToken 
      ? `${origin}/payment-link/${transactionToken}?payment=cancelled`
      : `${origin}/transactions`;

    logger.log("🌐 [CREATE-CHECKOUT] URLs configured", { origin, successUrl, cancelUrl });

    /**
     * Create Checkout Session
     * 
     * CRITICAL: Twint requires AUTOMATIC capture (instant payment)
     * - Twint does NOT support manual capture (escrow)
     * - Card/SEPA: manual capture for escrow
     * - Twint: automatic capture (instant, but we still track for refunds if needed)
     */
    const sessionData: Stripe.Checkout.SessionCreateParams = {
      customer: buyerProfile?.stripe_customer_id,
      customer_email: buyerProfile?.stripe_customer_id ? undefined : (buyerProfile?.email || user!.email),
      line_items: [
        {
          price_data: {
            currency: transaction.currency.toLowerCase(),
            product_data: {
              name: `RIVVLOCK Escrow: ${transaction.title}`,
              description: `Service date: ${transaction.service_date}`,
            },
            unit_amount: Math.round(transaction.price * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      payment_method_types: paymentMethodTypes,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        transaction_id: transactionId,
        buyer_id: user!.id,
      },
    };

    // Configure capture method based on session type
    if (isTwintSession) {
      // Twint: automatic capture (instant payment)
      sessionData.payment_intent_data = {
        capture_method: 'automatic', // Required for Twint
        metadata: {
          transaction_id: transactionId,
          seller_id: transaction.user_id,
          buyer_id: user!.id,
          service_date: transaction.service_date,
          platform: 'rivvlock',
          rivvlock_twint: 'true', // Mark as Twint (instant capture)
          payment_deadline: paymentDeadline.toISOString(),
        },
      };
      logger.log("⚡ [CREATE-CHECKOUT] Twint session configured with automatic capture");
    } else {
      // Card/SEPA: manual capture for escrow
      sessionData.payment_intent_data = {
        capture_method: 'manual', // CRITICAL for escrow
        metadata: {
          transaction_id: transactionId,
          seller_id: transaction.user_id,
          buyer_id: user!.id,
          service_date: transaction.service_date,
          platform: 'rivvlock',
          rivvlock_escrow: 'true',
          payment_deadline: paymentDeadline.toISOString(),
        },
      };
      logger.log("🔒 [CREATE-CHECKOUT] Standard session configured with manual capture (escrow)");
    }

    const session = await stripe.checkout.sessions.create(sessionData);
    logger.log("✅ [CREATE-CHECKOUT] Checkout session created:", session.id);

    // Update transaction with session ID
    const { error: updateError } = await adminClient!
      .from("transactions")
      .update({ 
        stripe_payment_intent_id: session.payment_intent as string,
        payment_method: isTwintSession ? 'twint' : 'card' // Will be updated by webhook with actual method used
      })
      .eq("id", transactionId);

    if (updateError) {
      logger.error("❌ [CREATE-CHECKOUT] Error updating transaction:", updateError);
      return errorResponse("Failed to update transaction", 500);
    }

    logger.log(`📧 [CREATE-CHECKOUT] Checkout session ready, URL: ${session.url}`);

    return successResponse({ 
      url: session.url,
      sessionUrl: session.url,
      sessionId: session.id 
    });
  } catch (error) {
    logger.error("❌ [CREATE-CHECKOUT] Error:", error);
    return errorResponse(error instanceof Error ? error.message : String(error), 500);
  }
};

const composedHandler = compose(
  withCors,
  withAuth,
  withRateLimit(),
  withValidation(schema)
)(handler);

Deno.serve(composedHandler);
