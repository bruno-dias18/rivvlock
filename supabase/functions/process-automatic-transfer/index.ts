import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
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
import { logger } from "../_shared/logger.ts";
import { calculateStripePayout, fromCents, formatFeeCalculation } from "../_shared/fee-calculator.ts";

const processTransferSchema = z.object({
  transaction_id: z.string().uuid(),
});

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  logger.log(`[AUTOMATIC-TRANSFER] ${step}${detailsStr}`);
};

const handler: Handler = async (req, ctx: HandlerContext) => {
  const { user, adminClient, body } = ctx;
  const { transaction_id } = body;

  logStep("Function started");

  // Get transaction details
  const { data: transaction, error: transactionError } = await adminClient!
    .from('transactions')
    .select('*')
    .eq('id', transaction_id)
    .single();

  if (transactionError) {
    return errorResponse(`Transaction not found: ${transactionError.message}`, 404);
  }
  if (!transaction) {
    return errorResponse("Transaction not found", 404);
  }

  // Verify user is the buyer and transaction is paid
  if (transaction.buyer_id !== user!.id) {
    return errorResponse("Only the buyer can trigger the transfer", 403);
  }

  if (transaction.status !== 'paid') {
    return errorResponse("Transaction must be paid to transfer funds", 400);
  }

  if (!transaction.stripe_payment_intent_id) {
    return errorResponse("No Stripe payment intent found", 400);
  }

  logStep("Transaction validated", { 
    transactionId: transaction.id, 
    sellerId: transaction.user_id,
    amount: transaction.price,
    currency: transaction.currency 
  });

  // Get seller's Stripe account
  const { data: sellerStripeAccount, error: accountError } = await adminClient!
    .from('stripe_accounts')
    .select('*')
    .eq('user_id', transaction.user_id)
    .single();

  if (accountError || !sellerStripeAccount) {
    return errorResponse("Seller does not have a configured Stripe account", 400);
  }

  if (!sellerStripeAccount.payouts_enabled || !sellerStripeAccount.charges_enabled) {
    return errorResponse("Seller's Stripe account is not ready for transfers", 400);
  }

  logStep("Seller Stripe account validated", { 
    accountId: sellerStripeAccount.stripe_account_id,
    payoutsEnabled: sellerStripeAccount.payouts_enabled 
  });

  // Initialize Stripe
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2024-06-20",
  });

  // ✅ Calculate payout using centralized fee calculator
  const payoutCalc = calculateStripePayout(transaction.price);
  
  logStep("Stripe payout calculated", formatFeeCalculation(payoutCalc, transaction.currency));

  // Get the charge ID from the payment intent
  const paymentIntent = await stripe.paymentIntents.retrieve(transaction.stripe_payment_intent_id);
  const chargeId = paymentIntent.latest_charge as string;
  
  if (!chargeId) {
    return errorResponse("No charge ID found in payment intent", 400);
  }
  
  logStep("Charge ID retrieved from payment intent", { chargeId });

  // Create transfer to connected account
  const transfer = await stripe.transfers.create({
    amount: payoutCalc.sellerAmount,
    currency: transaction.currency.toLowerCase(),
    destination: sellerStripeAccount.stripe_account_id,
    source_transaction: chargeId,
    description: `Transfer for transaction: ${transaction.title}`,
    metadata: {
      transaction_id: transaction.id,
      seller_id: transaction.user_id,
      buyer_id: transaction.buyer_id,
      platform_commission: payoutCalc.platformCommission,
      estimated_processor_fees: payoutCalc.estimatedProcessorFees,
      net_platform_revenue: payoutCalc.netPlatformRevenue
    }
  });

  logStep("Transfer created successfully", { 
    transferId: transfer.id,
    sellerReceived: `${fromCents(payoutCalc.sellerAmount).toFixed(2)} ${transaction.currency}`,
    netRevenue: `${fromCents(payoutCalc.netPlatformRevenue).toFixed(2)} ${transaction.currency}`,
    netMarginPercent: payoutCalc.netMarginPercent + '%'
  });

  // Update transaction status
  const { error: updateError } = await adminClient!
    .from('transactions')
    .update({
      status: 'validated',
      updated_at: new Date().toISOString()
    })
    .eq('id', transaction_id);

  if (updateError) {
    logStep("ERROR updating transaction status", { error: updateError.message });
    return errorResponse(`Failed to update transaction: ${updateError.message}`, 500);
  }

  // Log the activity
  await adminClient!.from('activity_logs').insert([
    {
      user_id: transaction.user_id,
      activity_type: 'funds_released',
      title: 'Fonds transférés vers votre compte',
      description: `Received ${fromCents(payoutCalc.sellerAmount).toFixed(2)} ${transaction.currency} for transaction: ${transaction.title}`,
      metadata: {
        transaction_id: transaction.id,
        transfer_id: transfer.id,
        amount: payoutCalc.sellerAmount,
        currency: transaction.currency,
        platform_commission: payoutCalc.platformCommission,
        estimated_processor_fees: payoutCalc.estimatedProcessorFees,
        net_platform_revenue: payoutCalc.netPlatformRevenue
      }
    },
    {
      user_id: transaction.buyer_id,
      activity_type: 'transaction_completed',
      title: 'Transaction terminée',
      description: `Fonds transférés au vendeur pour "${transaction.title}"`,
      metadata: {
        transaction_id: transaction.id,
        transfer_id: transfer.id,
        amount: payoutCalc.sellerAmount,
        currency: transaction.currency
      }
    }
  ]);

  logStep("Activity logs created");

  return successResponse({
    transfer_id: transfer.id,
    amount_transferred: payoutCalc.sellerAmount,
    currency: transaction.currency,
    platform_commission: payoutCalc.platformCommission,
    estimated_processor_fees: payoutCalc.estimatedProcessorFees,
    net_platform_revenue: payoutCalc.netPlatformRevenue,
    net_margin_percent: payoutCalc.netMarginPercent + '%',
    transaction_status: 'validated'
  });
};

const composedHandler = compose(
  withCors,
  withAuth,
  withRateLimit({ maxRequests: 5, windowMs: 60000 }),
  withValidation(processTransferSchema)
)(handler);

serve(composedHandler);
