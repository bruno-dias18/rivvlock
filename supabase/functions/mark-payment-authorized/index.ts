import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { 
  compose, 
  withCors, 
  withAuth, 
  withRateLimit, 
  withValidation,
  successResponse,
  errorResponse 
} from "../_shared/middleware.ts";
import { logger } from "../_shared/logger.ts";

const markPaymentSchema = z.object({
  transactionId: z.string().uuid(),
  paymentIntentId: z.string(),
});

const handler = async (ctx: any) => {
  const { user, adminClient, body } = ctx;
  const { transactionId, paymentIntentId } = body;

  logger.log('🔍 [MARK-PAYMENT] Starting payment authorization verification');
  
  // Get transaction details
  const { data: transaction, error: transactionError } = await adminClient
    .from("transactions")
    .select("*")
    .eq("id", transactionId)
    .single();

  if (transactionError || !transaction) {
    return errorResponse("Transaction not found", 404);
  }

  // CRITICAL: Verify that buyer_id is set before allowing payment
  if (!transaction.buyer_id) {
    logger.error('❌ [MARK-PAYMENT] Transaction has no buyer assigned');
    return errorResponse("Transaction must have a buyer assigned before payment can be authorized", 400);
  }

  // Verify user is authorized (buyer or seller)
  if (transaction.user_id !== user.id && transaction.buyer_id !== user.id) {
    return errorResponse("Unauthorized access to transaction", 403);
  }

  logger.log('✅ [MARK-PAYMENT] Transaction found and user authorized');

  // Initialize Stripe to verify payment
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2024-06-20",
  });

  // Verify payment intent status with Stripe
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  
  if (paymentIntent.status !== 'requires_capture') {
    return errorResponse(`Payment not in correct state: ${paymentIntent.status}`, 400);
  }

  logger.log('✅ [MARK-PAYMENT] Payment intent verified with Stripe');

  // Update transaction status
  const { error: updateError } = await adminClient
    .from("transactions")
    .update({ 
      status: 'paid',
      stripe_payment_intent_id: paymentIntentId,
      payment_method: 'stripe',
      payment_blocked_at: new Date().toISOString(),
      validation_deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48h
      updated_at: new Date().toISOString()
    })
    .eq("id", transactionId);

  if (updateError) {
    logger.error('❌ [MARK-PAYMENT] Error updating transaction:', updateError);
    return errorResponse("Failed to update transaction status", 500);
  }

  logger.log('✅ [MARK-PAYMENT] Transaction marked as paid successfully');

  // Log activity for funds blocked
  try {
    await adminClient.from('activity_logs').insert([
      {
        user_id: transaction.buyer_id,
        activity_type: 'funds_blocked',
        title: 'Fonds bloqués en séquestre',
        description: `${transaction.price} ${transaction.currency} bloqués pour la transaction "${transaction.title}"`,
        metadata: {
          transaction_id: transaction.id,
          amount: transaction.price,
          currency: transaction.currency
        }
      },
      {
        user_id: transaction.user_id,
        activity_type: 'funds_blocked',
        title: 'Paiement reçu et bloqué',
        description: `${transaction.price} ${transaction.currency} reçus et bloqués en attente de validation pour "${transaction.title}"`,
        metadata: {
          transaction_id: transaction.id,
          amount: transaction.price,
          currency: transaction.currency
        }
      }
    ]);
  } catch (logError) {
    logger.error('❌ [MARK-PAYMENT] Error logging activity:', logError);
  }

  logger.log(`📧 [MARK-PAYMENT] EMAIL: Payment authorized for ${transaction.title}`);
  logger.log(`📱 [MARK-PAYMENT] SMS: ${transaction.price} ${transaction.currency} blocked in escrow`);

  return successResponse({ 
    message: "Payment authorized and transaction updated"
  });
};

const composedHandler = compose(
  withCors,
  withAuth,
  withRateLimit({ maxRequests: 10, windowMs: 60000 }),
  withValidation(markPaymentSchema)
)(handler);

serve(composedHandler);
