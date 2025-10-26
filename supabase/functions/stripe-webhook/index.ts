import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { logger } from "../_shared/production-logger.ts";
import { 
  compose,
  withCors, 
  successResponse, 
  errorResponse,
  Handler,
  HandlerContext
} from "../_shared/middleware.ts";
import { checkRateLimit, getClientIp } from "../_shared/rate-limiter.ts";

// Rate limit configuration for webhooks (protect against abuse)
const WEBHOOK_RATE_LIMIT = {
  maxRequests: 100, // Max 100 webhooks per window
  windowMs: 60 * 1000, // 1 minute window
};

// Note: No withAuth for webhooks - Stripe calls this directly
const handler: Handler = async (req, ctx: HandlerContext) => {
  // ✅ RATE LIMITING: Check rate limit before processing
  const identifier = req.headers.get("stripe-signature")?.substring(0, 20) || 'unknown';
  const clientIp = getClientIp(req) || identifier;
  try {
    await checkRateLimit(clientIp);
  } catch (_e) {
    logger.warn("Webhook rate limit exceeded", { identifier: clientIp });
    return errorResponse("Rate limit exceeded", 429);
  }

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-06-20",
    });

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      logger.error("No stripe-signature header");
      throw new Error("No stripe-signature header");
    }

    const body = await req.text();
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!webhookSecret) {
      logger.error("STRIPE_WEBHOOK_SECRET not configured");
      throw new Error("Webhook secret not configured");
    }

    // Verify webhook signature
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    
    logger.info(`Stripe webhook event received: ${event.type}`, { eventId: event.id });

    // ✅ IDEMPOTENCY: Check if event already processed
    const { data: existingEvent } = await adminClient
      .from("webhook_events")
      .select("id")
      .eq("event_id", event.id)
      .single();

    if (existingEvent) {
      logger.info("Event already processed (idempotent)", { eventId: event.id });
      return successResponse({ received: true, idempotent: true });
    }

    // ✅ Log event for idempotency
    await adminClient
      .from("webhook_events")
      .insert({
        event_id: event.id,
        event_type: event.type,
        data: event.data.object as any,
      });

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const transactionId = paymentIntent.metadata.transaction_id;
      
      if (!transactionId) {
        logger.error("No transaction_id in payment intent metadata");
        throw new Error("No transaction_id in metadata");
      }

      logger.info("Payment succeeded", { transactionId });

      // Determine payment method used
      let paymentMethod = 'card';
      
      if (paymentIntent.payment_method) {
        const pm = await stripe.paymentMethods.retrieve(paymentIntent.payment_method as string);
        if (pm.type === 'customer_balance') {
          paymentMethod = 'bank_transfer';
          logger.debug("Bank transfer payment detected");
        } else if (pm.type === 'card') {
          paymentMethod = 'card';
          logger.debug("Card payment detected");
        } else if (pm.type === 'sepa_debit') {
          paymentMethod = 'sepa_debit';
          logger.debug("SEPA Direct Debit payment detected");
        }
      }

      // ✅ Validate transaction exists and can be updated
      const { data: transaction } = await adminClient
        .from("transactions")
        .select("id, status, price")
        .eq("id", transactionId)
        .single();

      if (!transaction) {
        logger.error("Transaction not found", { transactionId });
        throw new Error("Transaction not found");
      }

      if (transaction.status === "paid") {
        logger.info("Transaction already paid (idempotent)", { transactionId });
        return successResponse({ received: true, idempotent: true });
      }

      // ⚠️ IMPORTANT: With manual capture, payment_intent.succeeded is sent AFTER capture
      // This means funds have been captured and we can mark as truly "paid" (ready for payout)
      // The webhook should only update to "paid" after manual capture is done
      
      // Calculate validation deadline (48h for service transactions)
      const validationDeadline = new Date();
      validationDeadline.setHours(validationDeadline.getHours() + 48);

      // Update transaction to paid status (funds blocked/captured)
      const { error: updateError } = await adminClient
        .from("transactions")
        .update({
          status: "paid",
          payment_method: paymentMethod,
          payment_blocked_at: new Date().toISOString(),
          validation_deadline: validationDeadline.toISOString(),
        })
        .eq("id", transactionId)
        .eq("status", "pending");

      if (updateError) {
        logger.error("Error updating transaction", updateError, { transactionId });
        throw updateError;
      }

      // Log activity
      await adminClient
        .from("activity_logs")
        .insert({
          user_id: paymentIntent.metadata.buyer_id,
          activity_type: "funds_blocked",
          title: paymentMethod === 'bank_transfer' 
            ? "Virement bancaire reçu et bloqué" 
            : paymentMethod === 'sepa_debit'
              ? "Prélèvement SEPA reçu et bloqué"
              : "Paiement par carte reçu et bloqué",
          description: `Montant: ${(paymentIntent.amount / 100).toFixed(2)} ${paymentIntent.currency.toUpperCase()}`,
          metadata: {
            transaction_id: transactionId,
            payment_intent_id: paymentIntent.id,
            payment_method: paymentMethod,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
          },
        });

      logger.info("Transaction updated to paid (funds blocked)", { transactionId, paymentMethod });

      return successResponse({ received: true });
    }

    // ✅ Handle payment authorization (manual capture) - when funds are authorized but not yet captured
    // ✅ Handle payment intent amount capturable updated (manual capture authorization)
    if (event.type === "payment_intent.amount_capturable_updated") {
      const pi = event.data.object as Stripe.PaymentIntent;

      if (pi.capture_method === 'manual' && pi.status === 'requires_capture') {
        const transactionId = pi.metadata?.transaction_id;
        if (!transactionId) {
          logger.debug("No transaction_id in payment intent metadata for amount_capturable_updated");
          return successResponse({ received: true });
        }

        // Validate transaction exists
        const { data: transaction } = await adminClient
          .from("transactions")
          .select("id, status")
          .eq("id", transactionId)
          .single();

        if (!transaction) {
          logger.error("Transaction not found on amount_capturable_updated", { transactionId });
          return successResponse({ received: true });
        }

        if (transaction.status !== "pending") {
          logger.info("Transaction already updated (skip)", { transactionId, status: transaction.status });
          return successResponse({ received: true });
        }

        // Calculate validation deadline (48h)
        const validationDeadline = new Date();
        validationDeadline.setHours(validationDeadline.getHours() + 48);

        // Update transaction to paid (funds authorized/blocked)
        const { error: updateError } = await adminClient
          .from("transactions")
          .update({
            status: "paid",
            payment_method: "card",
            payment_blocked_at: new Date().toISOString(),
            validation_deadline: validationDeadline.toISOString(),
          })
          .eq("id", transactionId)
          .eq("status", "pending");

        if (updateError) {
          logger.error("Error updating transaction on amount_capturable_updated", updateError, { transactionId });
          throw updateError;
        }

        // Log activity
        await adminClient
          .from("activity_logs")
          .insert({
            user_id: pi.metadata?.buyer_id,
            activity_type: "funds_blocked",
            title: "Paiement par carte autorisé et bloqué",
            description: `Montant: ${(pi.amount / 100).toFixed(2)} ${pi.currency.toUpperCase()} - En attente de validation`,
            metadata: {
              transaction_id: transactionId,
              payment_intent_id: pi.id,
              payment_method: "card",
              amount: pi.amount,
              currency: pi.currency,
            },
          });

        logger.info("Transaction updated to paid (requires_capture)", { transactionId });
      }

      return successResponse({ received: true });
    }

    // ✅ Handle payment authorization (manual capture) - when funds are authorized but not yet captured
    if (event.type === "charge.succeeded") {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = charge.payment_intent as string;
      
      if (!paymentIntentId) {
        logger.debug("No payment_intent on charge (might be direct charge)");
        return successResponse({ received: true });
      }

      // Retrieve payment intent to get transaction_id
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      const transactionId = paymentIntent.metadata.transaction_id;
      
      if (!transactionId) {
        logger.debug("No transaction_id in payment intent metadata");
        return successResponse({ received: true });
      }

      // Check if payment intent is in requires_capture state (manual capture)
      if (paymentIntent.capture_method === 'manual' && paymentIntent.status === 'requires_capture') {
        logger.info("Charge authorized (manual capture), blocking funds", { transactionId, chargeId: charge.id });

        // Validate transaction exists
        const { data: transaction } = await adminClient
          .from("transactions")
          .select("id, status")
          .eq("id", transactionId)
          .single();

        if (!transaction) {
          logger.error("Transaction not found", { transactionId });
          throw new Error("Transaction not found");
        }

        if (transaction.status !== "pending") {
          logger.info("Transaction not in pending status", { transactionId, status: transaction.status });
          return successResponse({ received: true });
        }

        // Determine payment method
        let paymentMethod = 'card';
        if (charge.payment_method_details?.type === 'sepa_debit') {
          paymentMethod = 'sepa_debit';
        } else if (charge.payment_method_details?.type === 'card') {
          paymentMethod = 'card';
        }

        // Calculate validation deadline (48h)
        const validationDeadline = new Date();
        validationDeadline.setHours(validationDeadline.getHours() + 48);

        // Update transaction to paid status (funds authorized/blocked)
        const { error: updateError } = await adminClient
          .from("transactions")
          .update({
            status: "paid",
            payment_method: paymentMethod,
            payment_blocked_at: new Date().toISOString(),
            validation_deadline: validationDeadline.toISOString(),
          })
          .eq("id", transactionId)
          .eq("status", "pending");

        if (updateError) {
          logger.error("Error updating transaction after charge authorization", updateError, { transactionId });
          throw updateError;
        }

        // Log activity
        await adminClient
          .from("activity_logs")
          .insert({
            user_id: paymentIntent.metadata.buyer_id,
            activity_type: "funds_blocked",
            title: paymentMethod === 'sepa_debit'
              ? "Prélèvement SEPA autorisé et bloqué"
              : "Paiement par carte autorisé et bloqué",
            description: `Montant: ${(charge.amount / 100).toFixed(2)} ${charge.currency.toUpperCase()} - En attente de validation`,
            metadata: {
              transaction_id: transactionId,
              payment_intent_id: paymentIntentId,
              charge_id: charge.id,
              payment_method: paymentMethod,
              amount: charge.amount,
              currency: charge.currency,
            },
          });

        logger.info("Transaction updated to paid (funds authorized and blocked)", { transactionId, paymentMethod });
      }

      return successResponse({ received: true });
    }

    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const transactionId = paymentIntent.metadata.transaction_id;
      
      if (!transactionId) {
        logger.error("No transaction_id in failed payment intent");
        throw new Error("No transaction_id in metadata");
      }

      logger.warn("Payment failed for transaction", { transactionId });

      // Update transaction to expired status
      const { error: updateError } = await adminClient
        .from("transactions")
        .update({
          status: "expired",
        })
        .eq("id", transactionId);

      if (updateError) {
        logger.error("Error updating failed transaction", updateError, { transactionId });
        throw updateError;
      }

      // Log activity
      await adminClient
        .from("activity_logs")
        .insert({
          user_id: paymentIntent.metadata.buyer_id,
          activity_type: "payment_failed",
          title: "Échec du paiement",
          description: `Transaction expirée suite à l'échec du paiement`,
          metadata: {
            transaction_id: transactionId,
            payment_intent_id: paymentIntent.id,
            error: paymentIntent.last_payment_error?.message,
          },
        });

      logger.info("Transaction updated to expired after payment failure", { transactionId });

      return successResponse({ received: true });
    }

    // ✅ Handle charge.refunded
    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const transactionId = charge.metadata.transaction_id;
      
      if (!transactionId) {
        logger.warn("No transaction_id in charge.refunded metadata");
        return successResponse({ received: true });
      }

      logger.info("Charge refunded", { transactionId, chargeId: charge.id });

      const { error: updateError } = await adminClient
        .from("transactions")
        .update({
          refund_status: "refunded",
          funds_released: true,
          funds_released_at: new Date().toISOString(),
        })
        .eq("id", transactionId);

      if (updateError) {
        logger.error("Error updating refunded transaction", updateError, { transactionId });
        throw updateError;
      }

      logger.info("Transaction marked as refunded", { transactionId });
      return successResponse({ received: true });
    }

    // ✅ Handle customer.balance.updated (for manual bank transfers via Customer Balance)
    if (event.type === "customer.balance.updated") {
      const customer = event.data.object as any; // Customer with balance
      const customerId = customer.id;
      
      logger.info("Customer balance updated", { customerId, balance: customer.balance });

      // Find user with this Stripe customer
      const { data: profile } = await adminClient
        .from("profiles")
        .select("user_id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (!profile) {
        logger.warn("No user found for Stripe customer", { customerId });
        return successResponse({ received: true });
      }

      // Find pending transaction for this buyer
      const { data: transaction } = await adminClient
        .from("transactions")
        .select("id, status, price, currency")
        .eq("buyer_id", profile.user_id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!transaction) {
        logger.info("No pending transaction found for this customer", { customerId });
        return successResponse({ received: true });
      }

      // Check if balance covers transaction amount
      const balanceAmount = Math.abs(customer.balance); // Balance is negative when customer has credit
      const transactionAmount = Math.round(transaction.price * 100);

      if (balanceAmount >= transactionAmount) {
        logger.info("Sufficient balance for transaction", { 
          transactionId: transaction.id, 
          balance: balanceAmount,
          required: transactionAmount 
        });

        // Calculate validation deadline (48h)
        const validationDeadline = new Date();
        validationDeadline.setHours(validationDeadline.getHours() + 48);

        // Update transaction to paid status (escrow)
        const { error: updateError } = await adminClient
          .from("transactions")
          .update({
            status: "paid",
            payment_method: "bank_transfer",
            payment_blocked_at: new Date().toISOString(),
            validation_deadline: validationDeadline.toISOString(),
          })
          .eq("id", transaction.id)
          .eq("status", "pending");

        if (updateError) {
          logger.error("Error updating transaction after balance update", updateError, { transactionId: transaction.id });
          throw updateError;
        }

        // Log activity
        await adminClient
          .from("activity_logs")
          .insert({
            user_id: profile.user_id,
            activity_type: "funds_blocked",
            title: "Virement bancaire reçu et bloqué",
            description: `Montant: ${transaction.price.toFixed(2)} ${transaction.currency.toUpperCase()}`,
            metadata: {
              transaction_id: transaction.id,
              payment_method: "bank_transfer",
              amount: transactionAmount,
              currency: transaction.currency,
            },
          });

        logger.info("Transaction updated to paid after balance credit", { transactionId: transaction.id });
      }

      return successResponse({ received: true });
    }

    // ✅ Handle account.updated for Stripe Connect
    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      
      logger.info("Stripe account updated", { accountId: account.id });

      // Find user with this Stripe account
      const { data: stripeAccount } = await adminClient
        .from("stripe_accounts")
        .select("user_id")
        .eq("stripe_account_id", account.id)
        .single();

      if (!stripeAccount) {
        logger.warn("No user found for Stripe account", { accountId: account.id });
        return successResponse({ received: true });
      }

      // Update account status
      const { error: updateError } = await adminClient
        .from("stripe_accounts")
        .update({
          charges_enabled: account.charges_enabled || false,
          payouts_enabled: account.payouts_enabled || false,
          details_submitted: account.details_submitted || false,
          onboarding_completed: account.details_submitted || false,
          account_status: (account.charges_enabled && account.payouts_enabled) ? "active" : "pending",
          last_status_check: new Date().toISOString(),
        })
        .eq("stripe_account_id", account.id);

      if (updateError) {
        logger.error("Error updating Stripe account status", updateError, { accountId: account.id });
        throw updateError;
      }

      logger.info("Stripe account status synchronized", { 
        accountId: account.id, 
        userId: stripeAccount.user_id,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled 
      });

      return successResponse({ received: true });
    }

    // Unhandled event type
    logger.debug("Unhandled webhook event type", { eventType: event.type });
    
    return successResponse({ received: true });
  } catch (error) {
    logger.error("Stripe webhook error", error);
    return errorResponse(error instanceof Error ? error.message : String(error), 400);
  }
};

const composedHandler = compose(withCors)(handler);
Deno.serve(composedHandler);
