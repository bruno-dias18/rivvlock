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

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const { transactionId, paymentMethod } = await req.json();
    
    console.log("Creating payment intent for transaction:", transactionId);

    // Get transaction details
    const { data: transaction, error: transactionError } = await supabaseClient
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (transactionError || !transaction) {
      throw new Error("Transaction not found");
    }

    console.log("Transaction found:", transaction);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Get user profile to check for existing Stripe customer
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("stripe_customer_id, first_name, last_name")
      .eq("user_id", transaction.user_id)
      .single();

    console.log("Profile found:", profile?.stripe_customer_id ? "with Stripe customer" : "without Stripe customer");

    // Prepare payment intent data
    const paymentIntentData: any = {
      amount: Math.round(transaction.price * 100), // Convert to cents
      currency: transaction.currency.toLowerCase(),
      capture_method: 'manual', // This is key for escrow - we capture later
      description: `RIVVLOCK Escrow: ${transaction.title}`,
      metadata: {
        transaction_id: transactionId,
        seller_id: transaction.user_id,
        service_date: transaction.service_date,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    };

    // Use existing Stripe customer if available
    if (profile?.stripe_customer_id) {
      paymentIntentData.customer = profile.stripe_customer_id;
      console.log("Using existing Stripe customer:", profile.stripe_customer_id);
    }

    // Create payment intent with manual capture (escrow)
    const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

    console.log("Payment intent created:", paymentIntent.id);

    // Update transaction with payment intent ID
    const { error: updateError } = await supabaseClient
      .from("transactions")
      .update({ 
        stripe_payment_intent_id: paymentIntent.id,
        payment_method: paymentMethod 
      })
      .eq("id", transactionId);

    if (updateError) {
      console.error("Error updating transaction:", updateError);
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