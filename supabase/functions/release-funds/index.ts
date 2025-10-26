import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { logger } from "../_shared/logger.ts";
import { validateAndUpdateStripeAccount } from "../_shared/stripe-account-validator.ts";
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

const schema = z.object({
  transactionId: z.string().uuid(),
});

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  logger.log(`[RELEASE-FUNDS] ${step}${detailsStr}`);
};

const handler: Handler = async (req, ctx: HandlerContext) => {
  const { user, adminClient, body } = ctx;
  const { transactionId } = body;
  
  try {
    logStep("Function started");
    logStep("User authenticated", { userId: user!.id });
    logStep("Request data parsed", { transactionId });

    // Get transaction details
    const { data: transaction, error: transactionError } = await adminClient!
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .eq("buyer_id", user!.id) // Only buyer can release funds
      .eq("status", "paid")
      .single();

    if (transactionError || !transaction) {
      return errorResponse("Transaction not found or not authorized", 404);
    }
    logStep("Transaction found", { transactionId, sellerId: transaction.user_id });

    if (!transaction.stripe_payment_intent_id) {
      throw new Error("No Stripe payment intent found for this transaction");
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-06-20",
    });

    // Get seller's Stripe account details
    const { data: sellerStripeAccount, error: accountError } = await adminClient!
      .from('stripe_accounts')
      .select('*')
      .eq('user_id', transaction.user_id)
      .single();

    if (accountError || !sellerStripeAccount) {
      throw new Error("Seller does not have a configured Stripe account");
    }

    if (!sellerStripeAccount.payouts_enabled || !sellerStripeAccount.charges_enabled) {
      throw new Error("Seller's Stripe account is not ready for transfers");
    }

    // Validate Stripe account using shared validator
    try {
      const { isActive } = await validateAndUpdateStripeAccount(
        stripe,
        adminClient!,
        transaction.user_id,
        sellerStripeAccount.stripe_account_id
      );

      if (!isActive) {
        throw new Error("Seller's Stripe account is no longer active for transfers");
      }

      logStep("Stripe account validated and active", { 
        accountId: sellerStripeAccount.stripe_account_id
      });

    } catch (stripeError: any) {
      logStep("ERROR - Stripe account validation failed", { 
        accountId: sellerStripeAccount.stripe_account_id,
        error: stripeError.message 
      });

      return errorResponse(`Le compte Stripe du vendeur n'existe plus ou n'est plus actif. Veuillez contacter le support.`, 400);
    }

    // Check if funds have already been released to avoid duplicate transfers
    if (transaction.funds_released) {
      logStep("Funds already released for this transaction");
      return successResponse({ 
        success: true, 
        message: "Funds were already released for this transaction",
        transactionId: transaction.id
      });
    }

    // Retrieve the payment intent to check its current status
    let paymentIntent = await stripe.paymentIntents.retrieve(
      transaction.stripe_payment_intent_id
    );
    logStep("Payment intent retrieved", { 
      paymentIntentId: paymentIntent.id, 
      status: paymentIntent.status 
    });

    // Handle payment intent based on its current status
    if (paymentIntent.status === 'requires_capture') {
      // Capture the payment intent if it requires capturing
      paymentIntent = await stripe.paymentIntents.capture(
        transaction.stripe_payment_intent_id
      );
      logStep("Payment intent captured", { paymentIntentId: paymentIntent.id });
    } else if (paymentIntent.status === 'succeeded') {
      logStep("Payment intent already succeeded, proceeding to transfer");
    } else {
      throw new Error(`Payment intent status '${paymentIntent.status}' is not valid for fund release`);
    }

    // Get the charge ID from the payment intent for the transfer
    const chargeId = paymentIntent.latest_charge as string;
    if (!chargeId) {
      throw new Error("No charge ID found in payment intent");
    }
    logStep("Charge ID retrieved", { chargeId });

    // ✅ Seller always receives 95% of the original amount
    // RivvLock keeps 5% (gross) and pays processor fees from this amount
    const SELLER_PERCENTAGE = 0.95; // Seller receives 95%
    const RIVVLOCK_PERCENTAGE = 0.05; // RivvLock keeps 5%
    
    const originalAmount = Math.round(transaction.price * 100); // Convert to cents
    const sellerTransferAmount = Math.round(originalAmount * SELLER_PERCENTAGE);

    logStep("Transfer calculation", { 
      originalAmount, 
      sellerPercentage: SELLER_PERCENTAGE,
      sellerTransferAmount,
      rivvlockGrossCommission: originalAmount * RIVVLOCK_PERCENTAGE
    });

    // ✅ Retrieve the charge to get actual available balance after processor fees
    const charge = await stripe.charges.retrieve(chargeId);
    logStep("Charge retrieved", { 
      chargeId, 
      chargeAmount: charge.amount,
      applicationFeeAmount: charge.application_fee_amount
    });

    // ✅ Calculate net available balance (after Stripe fees)
    const stripeFees = originalAmount - (charge.amount - (charge.application_fee_amount || 0));
    const netAvailableBalance = charge.amount - (charge.application_fee_amount || 0);

    logStep("Balance calculation", {
      originalAmount,
      stripeFees,
      netAvailableBalance,
      sellerTransferAmount,
      sufficient: netAvailableBalance >= sellerTransferAmount
    });

    // ✅ Critical verification: ensure we have enough balance for the transfer
    if (sellerTransferAmount > netAvailableBalance) {
      const shortfall = sellerTransferAmount - netAvailableBalance;
      throw new Error(
        `Insufficient balance for transfer. Need ${sellerTransferAmount}, have ${netAvailableBalance} (shortfall: ${shortfall} cents)`
      );
    }

    // Create transfer to connected account using charge ID
    const transfer = await stripe.transfers.create({
      amount: sellerTransferAmount,
      currency: transaction.currency.toLowerCase(),
      destination: sellerStripeAccount.stripe_account_id,
      source_transaction: chargeId,
      description: `Transfer for transaction: ${transaction.title}`,
      metadata: {
        transaction_id: transaction.id,
        seller_id: transaction.user_id,
        buyer_id: transaction.buyer_id
      }
    });

    logStep("Transfer created", { transferId: transfer.id });

    // ✅ Calculate RivvLock's actual net margin (what remains in balance)
    const rivvlockNetMargin = netAvailableBalance - sellerTransferAmount;
    const rivvlockNetMarginPercent = (rivvlockNetMargin / originalAmount * 100).toFixed(2);

    logStep("RivvLock net margin calculated", {
      grossCommission: originalAmount * RIVVLOCK_PERCENTAGE,
      processorFees: stripeFees,
      netMargin: rivvlockNetMargin,
      netMarginPercent: rivvlockNetMarginPercent + '%',
      sellerReceived: sellerTransferAmount,
    });

    // Update transaction status to validated and mark funds as released
    const { error: updateError } = await adminClient!
      .from("transactions")
      .update({
        status: "validated",
        funds_released: true,
        funds_released_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", transactionId);

    if (updateError) {
      throw new Error(`Failed to update transaction: ${updateError.message}`);
    }
    logStep("Transaction updated to validated and funds marked as released");

    // Generate invoice if it doesn't exist yet
    const { data: existingInvoice } = await adminClient!
      .from('invoices')
      .select('id')
      .eq('transaction_id', transactionId)
      .maybeSingle();

    if (!existingInvoice) {
      logStep("Generating invoice for validated transaction");
      try {
        const { data: invoiceData, error: invoiceError } = await adminClient!.functions.invoke(
          'generate-invoice-number',
          {
            body: {
              transactionId: transactionId,
              sellerId: transaction.user_id,
              amount: transaction.price,
              currency: transaction.currency
            }
          }
        );

        if (!invoiceError && invoiceData?.invoiceNumber) {
          logStep("Invoice generated", { invoiceNumber: invoiceData.invoiceNumber });
        } else {
          logger.error("Failed to generate invoice:", invoiceError);
        }
      } catch (invoiceErr) {
        logger.error("Error generating invoice:", invoiceErr);
      }
    }

    // Log the activity for seller with actual amounts
    await adminClient!
      .from('activity_logs')
      .insert({
        user_id: transaction.user_id,
        activity_type: 'funds_released',
        title: 'Fonds transférés vers votre compte',
        description: `${(sellerTransferAmount / 100).toFixed(2)} ${transaction.currency} reçus pour "${transaction.title}"`,
        metadata: {
          transaction_id: transaction.id,
          transfer_id: transfer.id,
          amount: sellerTransferAmount,
          currency: transaction.currency,
          seller_percentage: SELLER_PERCENTAGE * 100,
          original_amount: originalAmount,
          processor_fees: stripeFees,
          rivvlock_net_margin: rivvlockNetMargin
        }
      });

    // Log for buyer
    await adminClient!
      .from('activity_logs')
      .insert({
        user_id: transaction.buyer_id,
        activity_type: 'transaction_completed',
        title: 'Transaction terminée',
        description: `Fonds transférés au vendeur pour "${transaction.title}"`,
        metadata: {
          transaction_id: transaction.id,
          transfer_id: transfer.id,
          amount: sellerTransferAmount,
          currency: transaction.currency
        }
      });

    logStep("Activity logs created");

    return successResponse({ 
      success: true, 
      message: "Funds released and transferred successfully",
      transactionId,
      transferId: transfer.id,
      amountTransferred: sellerTransferAmount,
      currency: transaction.currency,
      rivvlockNetMargin: rivvlockNetMargin,
      rivvlockNetMarginPercent: rivvlockNetMarginPercent + '%'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return errorResponse(errorMessage, 500);
  }
};

const composedHandler = compose(
  withCors,
  withAuth,
  withValidation(schema)
)(handler);

serve(composedHandler);