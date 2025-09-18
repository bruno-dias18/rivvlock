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

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const { transactionId } = await req.json();
    
    console.log("Capturing payment for transaction:", transactionId);

    // Get transaction details with auth check
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    if (!userData.user) throw new Error("Unauthorized");

    const { data: transaction, error: transactionError } = await supabaseClient
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .or(`user_id.eq.${userData.user.id},buyer_id.eq.${userData.user.id}`)
      .single();

    if (transactionError || !transaction) {
      throw new Error("Transaction not found or unauthorized");
    }

    if (!transaction.stripe_payment_intent_id) {
      throw new Error("No payment intent found for this transaction");
    }

    // Verify both parties have validated
    if (!transaction.seller_validated || !transaction.buyer_validated) {
      throw new Error("Both parties must validate before funds can be released");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Calculate platform fee (5%)
    const totalAmount = Math.round(transaction.price * 100);
    const platformFee = Math.round(totalAmount * 0.05);
    const sellerAmount = totalAmount - platformFee;

    // Capture the full payment intent
    const capturedIntent = await stripe.paymentIntents.capture(
      transaction.stripe_payment_intent_id,
      {
        application_fee_amount: platformFee, // 5% platform fee
      }
    );

    console.log("Payment captured:", capturedIntent.id, "Amount:", sellerAmount / 100, transaction.currency);

    // Update transaction status
    const { error: updateError } = await supabaseClient
      .from("transactions")
      .update({ 
        status: 'completed',
        funds_released: true,
        updated_at: new Date().toISOString()
      })
      .eq("id", transactionId);

    if (updateError) {
      console.error("Error updating transaction:", updateError);
      throw new Error("Failed to update transaction status");
    }

    // Mock notifications
    console.log(`📧 EMAIL: Funds released to seller - Amount: ${(sellerAmount / 100).toFixed(2)} ${transaction.currency}`);
    console.log(`📧 EMAIL: Transaction completed successfully for ${transaction.title}`);
    console.log(`📱 SMS: Payment of ${(sellerAmount / 100).toFixed(2)} ${transaction.currency} released to your account`);

    return new Response(JSON.stringify({ 
      success: true,
      amount_transferred: sellerAmount / 100,
      platform_fee: platformFee / 100,
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