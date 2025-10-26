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

const schema = z.object({
  transactionId: z.string().uuid(),
  paymentMethod: z.enum(["card", "twint", "bank_transfer"]).optional(),
});

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  logger.log(`[CREATE-ADYEN-PAYMENT] ${step}${detailsStr}`);
};

const handler: Handler = async (req, ctx: HandlerContext) => {
  const { user, adminClient, body } = ctx;
  const { transactionId, paymentMethod = "card" } = body;

  try {
    logStep("Function started");
    logStep("User authenticated", { userId: user!.id });
    logStep("Request data parsed", { transactionId, paymentMethod });

    // Get transaction details
    const { data: transaction, error: transactionError } = await adminClient!
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (transactionError || !transaction) {
      return errorResponse("Transaction not found", 404);
    }

    logStep("Transaction found", {
      transactionId,
      status: transaction.status,
      price: transaction.price,
    });

    // Verify user is the buyer
    if (transaction.buyer_id !== user!.id) {
      return errorResponse("Not authorized to pay for this transaction", 403);
    }

    // Check transaction status
    if (transaction.status !== "pending") {
      return errorResponse(
        `Transaction status '${transaction.status}' is not valid for payment`,
        400
      );
    }

    // Calculate amount in minor units (cents)
    const amount = Math.round(transaction.price * 100);

    logStep("Payment amount calculated", {
      originalPrice: transaction.price,
      amountInCents: amount,
      currency: transaction.currency,
    });

    // Initialize Adyen API
    const adyenApiKey = Deno.env.get("ADYEN_API_KEY");
    const adyenMerchantAccount = Deno.env.get("ADYEN_MERCHANT_ACCOUNT");

    if (!adyenApiKey || !adyenMerchantAccount) {
      throw new Error("Adyen configuration missing");
    }

    // Prepare Adyen payment request
    const origin = req.headers.get("origin") || "http://localhost:8080";
    
    const paymentRequest = {
      amount: {
        value: amount,
        currency: transaction.currency.toUpperCase(),
      },
      reference: `RIVV-${transactionId}`,
      merchantAccount: adyenMerchantAccount,
      returnUrl: `${origin}/payment-success?transaction=${transactionId}&provider=adyen`,
      // ✅ CRITICAL: Manual capture for escrow (like Stripe's manual)
      captureDelayHours: 999,
      metadata: {
        transaction_id: transactionId,
        seller_id: transaction.user_id,
        buyer_id: user!.id,
        payment_provider: "adyen",
      },
      // ✅ Block Amex to protect margins
      blockedPaymentMethods: ["amex"],
      allowedPaymentMethods: paymentMethod === "card" 
        ? ["visa", "mc"] // Only Visa and Mastercard
        : paymentMethod === "twint"
        ? ["twint"]
        : ["bankTransfer_IBAN"],
      shopperReference: user!.id,
      shopperEmail: user!.email,
      countryCode: transaction.currency === "CHF" ? "CH" : "FR",
      shopperLocale: "fr-CH",
      channel: "Web",
    };

    logStep("Calling Adyen Payments API", { reference: paymentRequest.reference });

    // Call Adyen Payments API
    const adyenResponse = await fetch(
      "https://checkout-test.adyen.com/v71/payments",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": adyenApiKey,
        },
        body: JSON.stringify(paymentRequest),
      }
    );

    const paymentData = await adyenResponse.json();

    if (!adyenResponse.ok) {
      logStep("ERROR - Adyen API error", paymentData);
      throw new Error(
        `Adyen API error: ${paymentData.message || "Unknown error"}`
      );
    }

    logStep("Adyen payment created", {
      resultCode: paymentData.resultCode,
      pspReference: paymentData.pspReference,
    });

    // Update transaction with Adyen PSP reference
    const { error: updateError } = await adminClient!
      .from("transactions")
      .update({
        adyen_psp_reference: paymentData.pspReference,
        payment_provider: "adyen",
        updated_at: new Date().toISOString(),
      })
      .eq("id", transactionId);

    if (updateError) {
      logStep("ERROR - Failed to update transaction", updateError);
      throw new Error(`Failed to update transaction: ${updateError.message}`);
    }

    logStep("Transaction updated with Adyen reference");

    return successResponse({
      resultCode: paymentData.resultCode,
      action: paymentData.action, // For 3D Secure redirects
      pspReference: paymentData.pspReference,
      paymentMethod: paymentMethod,
      sessionData: paymentData.sessionData,
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
