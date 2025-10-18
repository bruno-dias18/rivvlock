import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { logger } from "../_shared/logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Security: Never log auth errors that might expose token info
function sanitizeAuthError(error: any): string {
  if (!error) return 'Authentication failed';
  // Only log generic error message, never the actual error details
  return 'Invalid or expired authentication token';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // User client for authentication
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  // Admin client for database operations
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { transactionId, paymentMethod } = await req.json();
    
    logger.log("🔍 [CREATE-PAYMENT-INTENT] Creating payment intent for transaction:", transactionId);
    
    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logger.error("❌ [CREATE-PAYMENT-INTENT] No authorization header provided");
      throw new Error("Authentication required");
    }
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      logger.error("❌ [CREATE-PAYMENT-INTENT]", sanitizeAuthError(userError));
      throw new Error("Invalid authentication token");
    }
    
    logger.log("✅ [CREATE-PAYMENT-INTENT] User authenticated:", userData.user.id);

    // Get transaction details (using admin client)
    const { data: transaction, error: transactionError } = await adminClient
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (transactionError || !transaction) {
      logger.error("❌ [CREATE-PAYMENT-INTENT] Transaction not found:", transactionError);
      throw new Error("Transaction not found");
    }

    // Verify user is the buyer
    if (transaction.buyer_id !== userData.user.id) {
      logger.error("❌ [CREATE-PAYMENT-INTENT] User is not the buyer");
      throw new Error("Only the buyer can create payment intent");
    }

    logger.log("✅ [CREATE-PAYMENT-INTENT] Transaction found, buyer verified");

    // Calculate time until payment deadline
    const paymentDeadline = transaction.payment_deadline 
      ? new Date(transaction.payment_deadline) 
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default 7 days
    const now = new Date();
    const timeUntilDeadline = paymentDeadline.getTime() - now.getTime();
    const hoursUntilDeadline = timeUntilDeadline / (1000 * 60 * 60);
    
    logger.log(`⏰ [CREATE-PAYMENT-INTENT] Payment deadline: ${paymentDeadline.toISOString()}, hours until: ${hoursUntilDeadline.toFixed(2)}`);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-06-20",
    });

    // Get buyer profile to check for existing Stripe customer
    const { data: buyerProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("stripe_customer_id, first_name, last_name")
      .eq("user_id", userData.user.id)
      .single();

    logger.log("✅ [CREATE-PAYMENT-INTENT] Buyer profile found:", buyerProfile?.stripe_customer_id ? "with Stripe customer" : "without Stripe customer");

    // Determine available payment methods based on deadline
    const paymentMethodTypes = ['card'];
    
    // Only allow bank transfer if deadline is >= 72 hours (3 days) away
    // SEPA standard can take 1-3 business days
    if (hoursUntilDeadline >= 72) {
      paymentMethodTypes.push('customer_balance');
      logger.log("✅ [CREATE-PAYMENT-INTENT] Bank transfer available (deadline > 3 days)");
    } else {
      logger.log("⚠️ [CREATE-PAYMENT-INTENT] Bank transfer blocked (deadline < 3 days)");
    }

    // Prepare payment intent data
    const paymentIntentData: any = {
      amount: Math.round(transaction.price * 100), // Convert to cents
      currency: transaction.currency.toLowerCase(),
      capture_method: 'manual', // Key for escrow - we capture later
      description: `RIVVLOCK Escrow: ${transaction.title}`,
      metadata: {
        transaction_id: transactionId,
        transactionId: transactionId, // Alternative key for compatibility
        seller_id: transaction.user_id,
        buyer_id: userData.user.id,
        service_date: transaction.service_date,
        platform: 'rivvlock',
        rivvlock_escrow: 'true',
        bank_transfer_available: hoursUntilDeadline >= 72 ? 'yes' : 'no',
        hours_until_deadline: Math.round(hoursUntilDeadline).toString(),
        payment_deadline: paymentDeadline.toISOString(),
      },
      payment_method_types: paymentMethodTypes,
    };

    // Use existing Stripe customer if available (buyer's customer)
    if (buyerProfile?.stripe_customer_id) {
      paymentIntentData.customer = buyerProfile.stripe_customer_id;
      logger.log("✅ [CREATE-PAYMENT-INTENT] Using existing Stripe customer:", buyerProfile.stripe_customer_id);
    }

    // Create payment intent with manual capture (escrow)
    const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

    logger.log("✅ [CREATE-PAYMENT-INTENT] Payment intent created:", paymentIntent.id);

    // Update transaction with payment intent ID and payment method (using admin client)
    const { error: updateError } = await adminClient
      .from("transactions")
      .update({ 
        stripe_payment_intent_id: paymentIntent.id,
        payment_method: paymentMethod || 'card'
      })
      .eq("id", transactionId);

    if (updateError) {
      logger.error("❌ [CREATE-PAYMENT-INTENT] Error updating transaction:", updateError);
      throw new Error("Failed to update transaction");
    }

    // Mock notification
    logger.log(`📧 EMAIL: Payment intent created for transaction ${transaction.title}`);
    logger.log(`📱 SMS: Payment authorization requested for ${transaction.price} ${transaction.currency}`);

    return new Response(JSON.stringify({ 
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    logger.error("Error creating payment intent:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});