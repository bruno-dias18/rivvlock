import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[RELEASE-FUNDS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.id) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const { transactionId } = await req.json();
    if (!transactionId) throw new Error("Transaction ID is required");
    logStep("Request data parsed", { transactionId });

    // Get transaction details
    const { data: transaction, error: transactionError } = await supabaseClient
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .eq("buyer_id", user.id) // Only buyer can release funds
      .eq("status", "paid")
      .single();

    if (transactionError || !transaction) {
      throw new Error("Transaction not found or not authorized");
    }
    logStep("Transaction found", { transactionId, sellerId: transaction.user_id });

    if (!transaction.stripe_payment_intent_id) {
      throw new Error("No Stripe payment intent found for this transaction");
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Capture the payment intent to release funds to seller
    const paymentIntent = await stripe.paymentIntents.capture(
      transaction.stripe_payment_intent_id
    );
    logStep("Payment intent captured", { paymentIntentId: paymentIntent.id });

    // Update transaction status to validated
    const { error: updateError } = await supabaseClient
      .from("transactions")
      .update({
        status: "validated",
        updated_at: new Date().toISOString(),
      })
      .eq("id", transactionId);

    if (updateError) {
      throw new Error(`Failed to update transaction: ${updateError.message}`);
    }
    logStep("Transaction updated to validated");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Funds released successfully",
        transactionId 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});