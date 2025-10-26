import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { logger } from "../_shared/logger.ts";
import {
  compose,
  withCors,
  withAuth,
  withValidation,
  successResponse,
  errorResponse,
  Handler,
  HandlerContext,
} from "../_shared/middleware.ts";
import {
  calculateAdyenPayout,
  fromCents,
} from "../_shared/fee-calculator.ts";

const schema = z.object({
  transactionId: z.string().uuid(),
});

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  logger.log(`[RELEASE-FUNDS-ADYEN] ${step}${detailsStr}`);
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
      .eq("payment_provider", "adyen") // Only Adyen transactions
      .single();

    if (transactionError || !transaction) {
      return errorResponse("Transaction not found or not authorized", 404);
    }
    logStep("Transaction found", {
      transactionId,
      sellerId: transaction.user_id,
      pspReference: transaction.adyen_psp_reference,
    });

    if (!transaction.adyen_psp_reference) {
      throw new Error("No Adyen PSP reference found for this transaction");
    }

    // Check if funds have already been released
    if (transaction.funds_released) {
      logStep("Funds already released for this transaction");
      return successResponse({
        success: true,
        message: "Funds were already released for this transaction",
        transactionId: transaction.id,
      });
    }

    // ✅ Calculate payout using centralized fee calculator
    const payoutCalc = calculateAdyenPayout(transaction.price);

    logStep("Transfer calculation", {
      grossAmount: payoutCalc.grossAmount,
      platformCommission: payoutCalc.platformCommission,
      sellerAmount: payoutCalc.sellerAmount,
      estimatedProcessorFees: payoutCalc.estimatedProcessorFees,
      netPlatformRevenue: payoutCalc.netPlatformRevenue,
      netMarginPercent: payoutCalc.netMarginPercent,
    });

    // Initialize Adyen API
    const adyenApiKey = Deno.env.get("ADYEN_API_KEY");
    const adyenMerchantAccount = Deno.env.get("ADYEN_MERCHANT_ACCOUNT");

    if (!adyenApiKey || !adyenMerchantAccount) {
      throw new Error("Adyen configuration missing");
    }

    // ✅ Get seller's payout account (IBAN)
    const { data: payoutAccount, error: payoutAccountError } = await adminClient!
      .from("adyen_payout_accounts")
      .select("*")
      .eq("user_id", transaction.user_id)
      .eq("is_default", true)
      .eq("verified", true)
      .single();

    if (payoutAccountError || !payoutAccount) {
      throw new Error("Le vendeur n'a pas configuré de compte bancaire vérifié");
    }

    logStep("Seller payout account found", {
      iban: payoutAccount.iban.substring(0, 8) + "****", // Log partiel pour sécurité
      verified: payoutAccount.verified,
    });

    // ✅ Capture the payment (release escrow)
    const captureRequest = {
      merchantAccount: adyenMerchantAccount,
      amount: {
        value: payoutCalc.grossAmount,
        currency: transaction.currency.toUpperCase(),
      },
      reference: `RIVV-CAPTURE-${transactionId}`,
    };

    logStep("Capturing Adyen payment", {
      pspReference: transaction.adyen_psp_reference,
    });

    const captureResponse = await fetch(
      `https://checkout-test.adyen.com/v71/payments/${transaction.adyen_psp_reference}/captures`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": adyenApiKey,
        },
        body: JSON.stringify(captureRequest),
      }
    );

    const captureData = await captureResponse.json();

    if (!captureResponse.ok) {
      logStep("ERROR - Adyen capture failed", captureData);
      throw new Error(`Adyen capture error: ${captureData.message || "Unknown error"}`);
    }

    logStep("Adyen payment captured", {
      status: captureData.status,
      pspReference: captureData.pspReference,
    });

    logStep("Balance estimation", {
      grossAmount: payoutCalc.grossAmount,
      estimatedProcessorFees: payoutCalc.estimatedProcessorFees,
      platformCommission: payoutCalc.platformCommission,
      sellerAmount: payoutCalc.sellerAmount,
      netPlatformRevenue: payoutCalc.netPlatformRevenue,
      netMarginPercent: payoutCalc.netMarginPercent,
    });

    // ✅ Create payout entry in adyen_payouts table
    const { error: payoutError } = await adminClient!
      .from("adyen_payouts")
      .insert({
        transaction_id: transactionId,
        seller_id: transaction.user_id,
        gross_amount: payoutCalc.grossAmount,
        platform_commission: payoutCalc.platformCommission,
        seller_amount: payoutCalc.sellerAmount,
        estimated_processor_fees: payoutCalc.estimatedProcessorFees,
        net_platform_revenue: payoutCalc.netPlatformRevenue,
        currency: transaction.currency.toUpperCase(),
        iban_destination: payoutAccount.iban,
        bic: payoutAccount.bic,
        account_holder_name: payoutAccount.account_holder_name,
        status: "pending",
        metadata: {
          psp_reference: transaction.adyen_psp_reference,
          capture_reference: `RIVV-CAPTURE-${transactionId}`,
        },
      });

    if (payoutError) {
      throw new Error(`Failed to create payout entry: ${payoutError.message}`);
    }
    logStep("Payout entry created in adyen_payouts with status pending");

    // Update transaction status
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
    logStep("Transaction updated to validated");

    // Log activity for seller
    await adminClient!.from("activity_logs").insert({
      user_id: transaction.user_id,
      activity_type: "funds_released",
      title: "Fonds transférés (Adyen)",
      description: `${fromCents(payoutCalc.sellerAmount).toFixed(2)} ${
        transaction.currency
      } reçus pour "${transaction.title}"`,
      metadata: {
        transaction_id: transaction.id,
        psp_reference: transaction.adyen_psp_reference,
        amount: payoutCalc.sellerAmount,
        currency: transaction.currency,
        seller_percentage: 95,
        gross_amount: payoutCalc.grossAmount,
        processor_fees: payoutCalc.estimatedProcessorFees,
        rivvlock_net_margin: payoutCalc.netPlatformRevenue,
        payment_provider: "adyen",
      },
    });

    // Log for buyer
    await adminClient!.from("activity_logs").insert({
      user_id: transaction.buyer_id,
      activity_type: "transaction_completed",
      title: "Transaction terminée (Adyen)",
      description: `Fonds transférés au vendeur pour "${transaction.title}"`,
      metadata: {
        transaction_id: transaction.id,
        psp_reference: transaction.adyen_psp_reference,
        amount: payoutCalc.sellerAmount,
        currency: transaction.currency,
        payment_provider: "adyen",
      },
    });

    logStep("Activity logs created");

    return successResponse({
      success: true,
      message: "Funds released via Adyen successfully",
      transactionId,
      pspReference: transaction.adyen_psp_reference,
      amountTransferred: payoutCalc.sellerAmount,
      currency: transaction.currency,
      rivvlockNetMargin: payoutCalc.netPlatformRevenue,
      rivvlockNetMarginPercent: payoutCalc.netMarginPercent + "%",
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
