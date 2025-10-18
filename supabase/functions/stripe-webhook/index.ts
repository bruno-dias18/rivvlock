import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { logger } from "../_shared/production-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
    
    logger.info(`Stripe webhook event received: ${event.type}`);

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

      // Update transaction to paid status
      const { error: updateError } = await adminClient
        .from("transactions")
        .update({
          status: "paid",
          payment_method: paymentMethod,
        })
        .eq("id", transactionId);

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

      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
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

      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Unhandled event type
    logger.debug("Unhandled webhook event type", { eventType: event.type });
    
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    logger.error("Stripe webhook error", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
