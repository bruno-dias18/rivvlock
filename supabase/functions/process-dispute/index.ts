import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { 
  compose, 
  withCors, 
  withAuth, 
  withValidation,
  successResponse, 
  errorResponse,
  Handler, 
  HandlerContext 
} from "../_shared/middleware.ts";
import { logger } from "../_shared/logger.ts";
import { calculateRefund, formatRefundCalculation } from "../_shared/refund-calculator.ts";

/**
 * Validation schema for dispute processing request
 * @property {string} disputeId - UUID of the dispute to process
 * @property {'refund'|'release'} action - Admin decision: refund or release funds
 * @property {string} [adminNotes] - Optional internal notes for audit trail
 * @property {number} [refundPercentage=100] - Percentage to refund (0-100), default 100%
 */
const schema = z.object({
  disputeId: z.string().uuid(),
  action: z.enum(['refund', 'release']),
  adminNotes: z.string().optional(),
  refundPercentage: z.number().min(0).max(100).optional().default(100)
});

/**
 * Process admin dispute resolution with Stripe payment handling
 * 
 * This function handles the financial execution of admin dispute decisions:
 * - Validates admin authorization
 * - Retrieves dispute and transaction data
 * - Executes Stripe operations (refund/capture/transfer)
 * - Updates database records (dispute, transaction)
 * - Logs audit trail
 * 
 * @param {Request} _req - HTTP request (unused, data comes from middleware)
 * @param {HandlerContext} ctx - Context with user, clients, and validated body
 * @returns {Promise<Response>} Success/error response with operation status
 * 
 * @example
 * // Full refund
 * POST /process-dispute
 * { disputeId: "uuid", action: "refund", refundPercentage: 100 }
 * 
 * @example
 * // Partial refund (50%)
 * POST /process-dispute
 * { disputeId: "uuid", action: "refund", refundPercentage: 50 }
 * 
 * @example
 * // Release funds to seller
 * POST /process-dispute
 * { disputeId: "uuid", action: "release" }
 */
const handler: Handler = async (_req, ctx: HandlerContext) => {
  const { user, supabaseClient, adminClient, body } = ctx;
  const { disputeId, action, adminNotes, refundPercentage } = body;

  try {
    logger.log('[PROCESS-DISPUTE] START', { disputeId, action });

    // Verify user is admin
    const { data: isAdmin, error: adminCheckError } = await supabaseClient!.rpc('is_admin', { check_user_id: user!.id });
    if (adminCheckError || !isAdmin) {
      return errorResponse('Unauthorized: Admin access required', 403);
    }

    // Get dispute and related transaction
    const { data: dispute, error: disputeError } = await adminClient!
      .from('disputes')
      .select('*, transactions (*)')
      .eq('id', disputeId)
      .single();

    if (disputeError || !dispute) {
      return errorResponse('Dispute not found', 404);
    }

    const transaction = (dispute as any).transactions;
    if (!transaction?.stripe_payment_intent_id) {
      return errorResponse('No payment intent found for this transaction', 400);
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', { apiVersion: '2024-06-20' });

    let paymentIntent = await stripe.paymentIntents.retrieve(transaction.stripe_payment_intent_id);

    // Use centralized refund calculator for consistency
    const refundCalc = calculateRefund(transaction.price, refundPercentage ?? 100);
    
    logger.log('[PROCESS-DISPUTE] Refund calculation:', formatRefundCalculation(refundCalc, String(transaction.currency)));

    const { refundAmount, sellerAmount, platformFee, totalAmount } = refundCalc;
    const currency = String(transaction.currency).toLowerCase();

    let newTransactionStatus: 'validated' | 'disputed' | 'refunded' = 'disputed';
    let disputeStatus: 'resolved_refund' | 'resolved_release' = 'resolved_refund';

    if (action === 'refund') {

      if (paymentIntent.status === 'requires_capture') {
        await stripe.paymentIntents.cancel(transaction.stripe_payment_intent_id);
        if ((refundPercentage ?? 100) < 100 && sellerAmount > 0) {
          const { data: sellerAccount } = await adminClient!
            .from('stripe_accounts')
            .select('stripe_account_id')
            .eq('user_id', transaction.user_id)
            .maybeSingle();
          if (sellerAccount?.stripe_account_id) {
            await stripe.transfers.create({
              amount: sellerAmount,
              currency,
              destination: sellerAccount.stripe_account_id,
              transfer_group: `txn_${transaction.id}`,
              metadata: { dispute_id: dispute.id, type: 'partial_refund_seller_share', refund_percentage: String(refundPercentage) }
            });
          }
        }
      } else if (paymentIntent.status === 'succeeded') {
        await stripe.refunds.create({
          payment_intent: transaction.stripe_payment_intent_id,
          amount: refundAmount,
          reason: 'requested_by_customer',
          metadata: { dispute_id: dispute.id, admin_official: 'true', type: (refundPercentage ?? 100) === 100 ? 'admin_full_refund' : 'admin_partial_refund', refund_percentage: String(refundPercentage) }
        });
        if ((refundPercentage ?? 100) < 100 && sellerAmount > 0) {
          const { data: sellerAccount } = await adminClient!
            .from('stripe_accounts')
            .select('stripe_account_id')
            .eq('user_id', transaction.user_id)
            .maybeSingle();
          if (sellerAccount?.stripe_account_id) {
            await stripe.transfers.create({
              amount: sellerAmount,
              currency,
              destination: sellerAccount.stripe_account_id,
              transfer_group: `txn_${transaction.id}`,
              metadata: { dispute_id: dispute.id, type: 'partial_refund_seller_share', refund_percentage: String(refundPercentage) }
            });
          }
        }
      } else {
        return errorResponse(`PaymentIntent not refundable in status: ${paymentIntent.status}`, 400);
      }

      newTransactionStatus = 'refunded'; // Full ou partial refund → status 'refunded'
      disputeStatus = 'resolved_refund';
    } else {
      // release
      const { data: sellerAccount } = await adminClient!
        .from('stripe_accounts')
        .select('stripe_account_id')
        .eq('user_id', transaction.user_id)
        .maybeSingle();
      if (!sellerAccount?.stripe_account_id) {
        return errorResponse('Seller Stripe account not found', 400);
      }

      if (paymentIntent.status === 'requires_capture') {
        paymentIntent = await stripe.paymentIntents.capture(transaction.stripe_payment_intent_id);
      } else if (paymentIntent.status !== 'succeeded') {
        return errorResponse(`PaymentIntent not capturable in status: ${paymentIntent.status}`, 400);
      }

      let chargeId = paymentIntent.latest_charge as string | null;
      if (!chargeId) {
        const refreshed = await stripe.paymentIntents.retrieve(transaction.stripe_payment_intent_id);
        paymentIntent = refreshed;
        chargeId = paymentIntent.latest_charge as string | null;
      }
      if (!chargeId) {
        return errorResponse('No charge ID found in payment intent', 400);
      }

      const transferAmount = totalAmount - platformFee;
      if (transferAmount > 0) {
        await stripe.transfers.create({
          amount: transferAmount,
          currency,
          destination: sellerAccount.stripe_account_id,
          source_transaction: chargeId,
          transfer_group: `txn_${transaction.id}`,
          description: `Admin release for transaction ${transaction.id}`,
          metadata: { dispute_id: dispute.id, type: 'admin_release_transfer' }
        });
      }

      newTransactionStatus = 'validated';
      disputeStatus = 'resolved_release';
    }

    // Update dispute
    const resolutionText = action === 'refund' 
      ? `Décision administrative: ${(refundPercentage ?? 100) === 100 ? 'full_refund' : 'partial_refund'} - ${refundPercentage ?? 100}% refund`
      : `Décision administrative: no_refund - 0% refund`;

    const { error: disputeUpdateError } = await adminClient!
      .from('disputes')
      .update({
        status: disputeStatus,
        resolved_at: new Date().toISOString(),
        resolution: resolutionText,
        updated_at: new Date().toISOString()
      })
      .eq('id', disputeId);
    if (disputeUpdateError) {
      logger.error('Error updating dispute:', disputeUpdateError);
    }

    // Save admin notes
    if (adminNotes) {
      const { error: notesError } = await adminClient!
        .from('admin_dispute_notes')
        .insert({ dispute_id: disputeId, admin_user_id: user!.id, notes: adminNotes });
      if (notesError) {
        logger.error('Error saving admin notes:', notesError);
      }
    }

    // Update transaction
    const transactionUpdate: any = {
      status: newTransactionStatus,
      funds_released: action === 'release',
      funds_released_at: action === 'release' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };
    if (action === 'refund') {
      transactionUpdate.refund_status = (refundPercentage ?? 100) === 100 ? 'full' : 'partial';
      transactionUpdate.refund_amount = Math.round((transaction.price * (refundPercentage ?? 100)) / 100);
    }
    const { error: transactionUpdateError } = await adminClient!
      .from('transactions')
      .update(transactionUpdate)
      .eq('id', transaction.id);
    if (transactionUpdateError) {
      logger.error('Error updating transaction:', transactionUpdateError);
      return errorResponse('Failed to update transaction', 500);
    }

    return successResponse({ action, dispute_status: disputeStatus, transaction_status: newTransactionStatus });
  } catch (error: any) {
    logger.error('Error processing dispute:', error);
    return errorResponse(error.message ?? 'Internal error', 500);
  }
};

const composedHandler = compose(
  withCors,
  withAuth,
  withValidation(schema)
)(handler);

serve(composedHandler);
