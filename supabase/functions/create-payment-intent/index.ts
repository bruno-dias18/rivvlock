import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    
    console.log("🔍 [CREATE-PAYMENT-INTENT] Creating payment intent for transaction:", transactionId);
    
    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("❌ [CREATE-PAYMENT-INTENT] No authorization header provided");
      throw new Error("Authentication required");
    }
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      console.error("❌ [CREATE-PAYMENT-INTENT] Invalid user token:", userError);
      throw new Error("Invalid authentication token");
    }
    
    console.log("✅ [CREATE-PAYMENT-INTENT] User authenticated:", userData.user.id);

    // Get transaction details (using admin client)
    const { data: transaction, error: transactionError } = await adminClient
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (transactionError || !transaction) {
      console.error("❌ [CREATE-PAYMENT-INTENT] Transaction not found:", transactionError);
      throw new Error("Transaction not found");
    }

    // Verify user is the buyer
    if (transaction.buyer_id !== userData.user.id) {
      console.error("❌ [CREATE-PAYMENT-INTENT] User is not the buyer");
      throw new Error("Only the buyer can create payment intent");
    }

    console.log("✅ [CREATE-PAYMENT-INTENT] Transaction found, buyer verified");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-06-20",
    });

    // Get buyer profile to check for existing Stripe customer
    const { data: buyerProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("stripe_customer_id, first_name, last_name")
      .eq("user_id", userData.user.id)
      .single();

    console.log("✅ [CREATE-PAYMENT-INTENT] Buyer profile found:", buyerProfile?.stripe_customer_id ? "with Stripe customer" : "without Stripe customer");

    // Prepare payment intent data
    const paymentIntentData: any = {
      amount: Math.round(transaction.price * 100), // Convert to cents
      currency: transaction.currency.toLowerCase(),
      capture_method: 'manual', // Key for escrow - we capture later
      description: `RIVVLOCK Escrow: ${transaction.title}`,
      metadata: {
        transaction_id: transactionId,
        seller_id: transaction.user_id,
        buyer_id: userData.user.id,
        service_date: transaction.service_date,
        platform: 'rivvlock',
      },
      automatic_payment_methods: {
        enabled: true,
      },
    };

    // Use existing Stripe customer if available (buyer's customer)
    if (buyerProfile?.stripe_customer_id) {
      paymentIntentData.customer = buyerProfile.stripe_customer_id;
      console.log("✅ [CREATE-PAYMENT-INTENT] Using existing Stripe customer:", buyerProfile.stripe_customer_id);
    }

    // Create payment intent with manual capture (escrow)
    const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

    console.log("✅ [CREATE-PAYMENT-INTENT] Payment intent created:", paymentIntent.id);

    // Update transaction with payment intent ID (using admin client)
    const { error: updateError } = await adminClient
      .from("transactions")
      .update({ 
        stripe_payment_intent_id: paymentIntent.id,
        payment_method: paymentMethod 
      })
      .eq("id", transactionId);

    if (updateError) {
      console.error("❌ [CREATE-PAYMENT-INTENT] Error updating transaction:", updateError);
      throw new Error("Failed to update transaction");
    }

    // Mock notification
    console.log(`📧 EMAIL: Payment intent created for transaction ${transaction.title}`);
    console.log(`📱 SMS: Payment authorization requested for ${transaction.price} ${transaction.currency}`);

    return new Response(JSON.stringify({ 
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error creating payment intent:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});