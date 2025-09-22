import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
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
    const { transactionId } = await req.json();
    
    console.log("🔍 [CAPTURE-PAYMENT] Capturing payment for transaction:", transactionId);

    // Get user authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authentication required");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Unauthorized");

    console.log("✅ [CAPTURE-PAYMENT] User authenticated:", userData.user.id);

    // Get transaction details (using admin client)
    const { data: transaction, error: transactionError } = await adminClient
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (transactionError || !transaction) {
      console.error("❌ [CAPTURE-PAYMENT] Transaction not found:", transactionError);
      throw new Error("Transaction not found");
    }

    // Verify user is authorized (buyer or seller)
    if (transaction.user_id !== userData.user.id && transaction.buyer_id !== userData.user.id) {
      throw new Error("Unauthorized access to transaction");
    }

    if (!transaction.stripe_payment_intent_id) {
      throw new Error("No payment intent found for this transaction");
    }

    // Verify user is the buyer for fund release
    if (transaction.buyer_id !== userData.user.id) {
      throw new Error("Only the buyer can release funds");
    }

    // Mark buyer as validated
    const { error: validationError } = await adminClient
      .from("transactions")
      .update({ 
        buyer_validated: true,
        updated_at: new Date().toISOString()
      })
      .eq("id", transactionId);

    if (validationError) {
      console.error("❌ [CAPTURE-PAYMENT] Error updating buyer validation:", validationError);
      throw new Error("Failed to update buyer validation");
    }

    // Only capture funds if seller has also validated
    if (!transaction.seller_validated) {
      console.log("✅ [CAPTURE-PAYMENT] Buyer validated, waiting for seller validation");
      return new Response(JSON.stringify({ 
        success: true,
        message: "Buyer validation completed. Waiting for seller validation before fund release.",
        funds_captured: false
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    console.log("✅ [CAPTURE-PAYMENT] Transaction validation verified");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-06-20",
    });

    // Capture the payment intent (without application fee for now)
    const capturedIntent = await stripe.paymentIntents.capture(
      transaction.stripe_payment_intent_id
    );

    console.log("✅ [CAPTURE-PAYMENT] Payment captured:", capturedIntent.id, "Amount:", capturedIntent.amount / 100, transaction.currency);

    // Update transaction status to validated (using admin client)
    const { error: updateError } = await adminClient
      .from("transactions")
      .update({ 
        status: 'validated',
        funds_released: true,
        updated_at: new Date().toISOString()
      })
      .eq("id", transactionId);

    if (updateError) {
      console.error("❌ [CAPTURE-PAYMENT] Error updating transaction:", updateError);
      throw new Error("Failed to update transaction status");
    }

    // Mock notifications
    console.log(`📧 [CAPTURE-PAYMENT] EMAIL: Funds released to seller - Amount: ${(capturedIntent.amount / 100).toFixed(2)} ${transaction.currency}`);
    console.log(`📧 [CAPTURE-PAYMENT] EMAIL: Transaction completed successfully for ${transaction.title}`);
    console.log(`📱 [CAPTURE-PAYMENT] SMS: Payment of ${(capturedIntent.amount / 100).toFixed(2)} ${transaction.currency} released to your account`);

    return new Response(JSON.stringify({ 
      success: true,
      amount_transferred: capturedIntent.amount / 100,
      currency: transaction.currency
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error capturing payment:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});