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
 * Validation schema for payment intent creation
 * @property {string} transactionId - UUID of the transaction to create payment for
 * @property {string} [paymentMethod] - Optional payment method preference ('card', 'bank_transfer')
 */
const schema = z.object({
  transactionId: z.string().uuid(),
  paymentMethod: z.string().optional(),
});

/**
 * Create Stripe Payment Intent with escrow configuration
 * 
 * This function creates a Stripe Payment Intent with manual capture for escrow:
 * - Validates buyer authorization
 * - Calculates available payment methods based on deadline
 * - Creates Payment Intent with capture_method='manual' (key for escrow)
 * - Links Payment Intent to transaction
 * 
 * Payment method availability:
 * - Card: Always available
 * - Bank transfer: Only if deadline >= 72 hours (SEPA processing time)
 * 
 * @param {Request} req - HTTP request
 * @param {HandlerContext} ctx - Context with user, clients, and validated body
 * @returns {Promise<Response>} Success with clientSecret or error
 * 
 * @example
 * // Create payment intent for transaction
 * POST /create-payment-intent
 * { transactionId: "uuid", paymentMethod: "card" }
 * 
 * Response: { clientSecret: "pi_xxx_secret_yyy", paymentIntentId: "pi_xxx" }
 */
const handler: Handler = async (req, ctx: HandlerContext) => {
  const { user, adminClient, body } = ctx;
  const { transactionId, paymentMethod } = body;
  
  try {
    logger.log("🔍 [CREATE-PAYMENT-INTENT] Creating payment intent for transaction:", transactionId);
    logger.log("✅ [CREATE-PAYMENT-INTENT] User authenticated:", user!.id);

    // Get transaction details (using admin client)
    const { data: transaction, error: transactionError } = await adminClient!
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (transactionError || !transaction) {
      logger.error("❌ [CREATE-PAYMENT-INTENT] Transaction not found:", transactionError);
      return errorResponse("Transaction not found", 404);
    }

    // Verify user is the buyer
    if (transaction.buyer_id !== user!.id) {
      logger.error("❌ [CREATE-PAYMENT-INTENT] User is not the buyer");
      return errorResponse("Only the buyer can create payment intent", 403);
    }

    logger.log("✅ [CREATE-PAYMENT-INTENT] Transaction found, buyer verified");

    // Calculate time until payment deadline
    const paymentDeadline = transaction.payment_deadline 
      ? new Date(transaction.payment_deadline) 
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default 7 days
    const now = new Date();
    const timeUntilDeadline = paymentDeadline.getTime() - now.getTime();
    const hoursUntilDeadline = timeUntilDeadline / (1000 * 60 * 60);
    
    logger.log(`⏰ [CREATE-PAYMENT-INTENT] Payment deadline: ${paymentDeadline.toISOString()}, hours until: ${hoursUntilDeadline.toFixed(2)}`);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-06-20",
    });

    // Get buyer profile to check for existing Stripe customer
    const { data: buyerProfile, error: profileError } = await adminClient!
      .from("profiles")
      .select("stripe_customer_id, first_name, last_name")
      .eq("user_id", user!.id)
      .single();

    logger.log("✅ [CREATE-PAYMENT-INTENT] Buyer profile found:", buyerProfile?.stripe_customer_id ? "with Stripe customer" : "without Stripe customer");

    /**
     * PAYMENT METHOD AVAILABILITY LOGIC
     * 
     * Card: Always available (instant processing)
     * 
     * Bank Transfer Methods (both require 72h):
     * 
     * A) SEPA Direct Debit (via Stripe Checkout):
     *    - Stripe prélève automatiquement depuis compte client
     *    - Processing time: 1-3 business days
     *    - Only available if deadline ≥ 72h
     *    - Escrow: ✅ (funds on Stripe)
     * 
     * B) Manual Bank Transfer (via Stripe Customer Balance):
     *    - Client fait virement vers IBAN Stripe virtuel
     *    - Processing time: 1-3 business days (SEPA standard/instant)
     *    - Only available if deadline ≥ 72h
     *    - Escrow: ✅ (funds on Stripe)
     * 
     * Why 72h minimum?
     * - Standard SEPA transfers: 1-3 business days
     * - Need buffer to ensure funds arrive before deadline
     * - 72h = 3 days minimum ensures safe processing window
     * 
     * Example:
     * - Transaction created Monday 10:00
     * - Payment deadline Friday 10:00 (96 hours)
     * - Both bank methods available: YES (96h > 72h)
     * 
     * - Transaction created Wednesday 10:00
     * - Payment deadline Friday 10:00 (48 hours)
     * - Bank methods available: NO (48h < 72h), only card
     * 
     * Future: SEPA Instant (< 30 min) could bypass 72h rule
     */
    const paymentMethodTypes = ['card'];
    
    // Only allow SEPA Direct Debit if deadline is >= 72 hours (3 days) away
    // SEPA Direct Debit can take 1-3 business days to collect
    if (hoursUntilDeadline >= 72) {
      paymentMethodTypes.push('sepa_debit');
      logger.log("✅ [CREATE-PAYMENT-INTENT] SEPA Direct Debit available (deadline > 3 days)");
    } else {
      logger.log("⚠️ [CREATE-PAYMENT-INTENT] SEPA Direct Debit blocked (deadline < 3 days)");
    }
    
    // NOTE: Twint is NOT supported - incompatible with escrow model

    /**
     * PAYMENT INTENT CONFIGURATION FOR ESCROW
     * 
     * capture_method: 'manual' is CRITICAL for escrow functionality:
     * - Authorizes funds on buyer's card immediately
     * - Does NOT charge the buyer yet
     * - Funds held for up to 7 days (Stripe limit)
     * - We capture later after service validation
     * - Or cancel if dispute/expiration
     * 
     * This ensures buyer protection and seller security:
     * - Buyer: Money not taken until service validated
     * - Seller: Guaranteed funds are available
     * - Platform: Can manage disputes and refunds
     */
    const paymentIntentData: any = {
      amount: Math.round(transaction.price * 100), // Convert to cents
      currency: transaction.currency.toLowerCase(),
      capture_method: 'manual', // Key for escrow - we capture later
      description: `RIVVLOCK Escrow: ${transaction.title}`,
      metadata: {
        transaction_id: transactionId,
        transactionId: transactionId, // Alternative key for compatibility
        seller_id: transaction.user_id,
        buyer_id: user!.id,
        service_date: transaction.service_date,
        platform: 'rivvlock',
        rivvlock_escrow: 'true',
        bank_transfer_available: hoursUntilDeadline >= 72 ? 'yes' : 'no',
        hours_until_deadline: Math.round(hoursUntilDeadline).toString(),
        payment_deadline: paymentDeadline.toISOString(),
      },
      payment_method_types: paymentMethodTypes,
    };

    // Use existing Stripe customer if available (buyer's customer)
    if (buyerProfile?.stripe_customer_id) {
      paymentIntentData.customer = buyerProfile.stripe_customer_id;
      logger.log("✅ [CREATE-PAYMENT-INTENT] Using existing Stripe customer:", buyerProfile.stripe_customer_id);
    }

    // Create payment intent with manual capture (escrow)
    const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

    logger.log("✅ [CREATE-PAYMENT-INTENT] Payment intent created:", paymentIntent.id);

    // Update transaction with payment intent ID and payment method (using admin client)
    const { error: updateError } = await adminClient!
      .from("transactions")
      .update({ 
        stripe_payment_intent_id: paymentIntent.id,
        payment_method: paymentMethod || 'card'
      })
      .eq("id", transactionId);

    if (updateError) {
      logger.error("❌ [CREATE-PAYMENT-INTENT] Error updating transaction:", updateError);
      return errorResponse("Failed to update transaction", 500);
    }

    // Mock notification
    logger.log(`📧 EMAIL: Payment intent created for transaction ${transaction.title}`);
    logger.log(`📱 SMS: Payment authorization requested for ${transaction.price} ${transaction.currency}`);

    return successResponse({ 
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id 
    });
  } catch (error) {
    logger.error("Error creating payment intent:", error);
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
