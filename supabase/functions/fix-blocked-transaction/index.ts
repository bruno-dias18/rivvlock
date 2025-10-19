import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
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
import { createServiceClient } from "../_shared/supabase-utils.ts";
import { logger } from "../_shared/logger.ts";

const fixTransactionSchema = z.object({
  transactionId: z.string().uuid(),
  paymentIntentId: z.string().optional(),
});

const handler: Handler = async (_req, ctx: HandlerContext) => {
  const { body } = ctx;
  const { transactionId, paymentIntentId } = body;

  try {
    const adminClient = createServiceClient();

    logger.log(`[FIX-TRANSACTION] Starting fix for transaction: ${transactionId}`);

    // Update status first
    const { error: statusError } = await adminClient
      .from("transactions")
      .update({ status: 'paid' })
      .eq("id", transactionId);

    if (statusError) {
      throw new Error(`Failed to update status: ${statusError.message}`);
    }

    // Update payment intent ID if provided
    if (paymentIntentId) {
      const { error: paymentError } = await adminClient
        .from("transactions")
        .update({ stripe_payment_intent_id: paymentIntentId })
        .eq("id", transactionId);

      if (paymentError) {
        logger.log(`[FIX-TRANSACTION] Warning: Could not update payment intent ID: ${paymentError.message}`);
      }
    }

    // Update timestamps
    const { error: timestampError } = await adminClient
      .from("transactions")
      .update({ 
        payment_blocked_at: new Date().toISOString(),
        validation_deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48 hours
        updated_at: new Date().toISOString()
      })
      .eq("id", transactionId);

    if (timestampError) {
      logger.log(`[FIX-TRANSACTION] Warning: Could not update timestamps: ${timestampError.message}`);
    }

    logger.log(`[FIX-TRANSACTION] Successfully fixed transaction: ${transactionId}`);

    return successResponse({ 
      message: "Transaction fixed successfully",
      transactionId
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[FIX-TRANSACTION] Error:`, errorMessage);
    return errorResponse(errorMessage, 500);
  }
};

const composedHandler = compose(
  withCors,
  withAuth,
  withRateLimit(),
  withValidation(fixTransactionSchema)
)(handler);

serve(composedHandler);
