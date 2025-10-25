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
import { rateLimiter } from "../_shared/rate-limiter.ts";

// Rate limit configuration for webhooks (protect against abuse)
const WEBHOOK_RATE_LIMIT = {
  maxRequests: 100, // Max 100 webhooks per window
  windowMs: 60 * 1000, // 1 minute window
};

// Note: No withAuth for webhooks - Stripe calls this directly
const handler: Handler = async (req, ctx: HandlerContext) => {
  // ✅ RATE LIMITING: Check rate limit before processing
  const identifier = req.headers.get("stripe-signature")?.substring(0, 20) || 'unknown';
  const rateLimitResult = await rateLimiter(
    `webhook_${identifier}`,
    WEBHOOK_RATE_LIMIT.maxRequests,
    WEBHOOK_RATE_LIMIT.windowMs
  );
  
  if (!rateLimitResult.allowed) {
    logger.warn("Webhook rate limit exceeded", { 
      identifier,
      attemptsSoFar: rateLimitResult.current 
    });
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

      // Calculate validation deadline (72h for service transactions)
      const validationDeadline = new Date();
      validationDeadline.setHours(validationDeadline.getHours() + 72);

      // Update transaction to paid status
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

      logger.info("Transaction updated to paid", { transactionId, paymentMethod });

      // 🔔 Send push notification to seller
      try {
        const { data: txData } = await adminClient
          .from("transactions")
          .select("user_id, title, buyer_display_name")
          .eq("id", transactionId)
          .single();

        if (txData) {
          await adminClient.functions.invoke('send-push-notification', {
            body: {
              userId: txData.user_id,
              title: '💰 Paiement reçu',
              body: `${txData.buyer_display_name || 'L\'acheteur'} a payé pour "${txData.title}"`,
              url: `/transactions`,
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              tag: `payment-${transactionId}`,
            },
          });
        }
      } catch (notifError) {
        logger.error("Failed to send payment notification", notifError);
        // Non-blocking: continue even if notification fails
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
