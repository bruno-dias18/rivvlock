import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 [MARK-PAYMENT] Starting payment authorization verification');

    // User client for authentication
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Admin client for database updates
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authentication required");
    }
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      throw new Error("Invalid authentication token");
    }

    console.log('✅ [MARK-PAYMENT] User authenticated:', userData.user.id);

    const { transactionId, paymentIntentId } = await req.json();
    
    // Get transaction details (using admin client to bypass RLS)
    const { data: transaction, error: transactionError } = await adminClient
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (transactionError || !transaction) {
      throw new Error("Transaction not found");
    }

    // Verify user is authorized (buyer or seller)
    if (transaction.user_id !== userData.user.id && transaction.buyer_id !== userData.user.id) {
      throw new Error("Unauthorized access to transaction");
    }

    console.log('✅ [MARK-PAYMENT] Transaction found and user authorized');

    // Initialize Stripe to verify payment
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-06-20",
    });

    // Verify payment intent status with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'requires_capture') {
      throw new Error(`Payment not in correct state: ${paymentIntent.status}`);
    }

    console.log('✅ [MARK-PAYMENT] Payment intent verified with Stripe');

    // Update transaction status using admin client
    const { error: updateError } = await adminClient
      .from("transactions")
      .update({ 
        status: 'paid',
        stripe_payment_intent_id: paymentIntentId,
        payment_method: 'stripe',
        payment_blocked_at: new Date().toISOString(),
        validation_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        updated_at: new Date().toISOString()
      })
      .eq("id", transactionId);

    if (updateError) {
      console.error('❌ [MARK-PAYMENT] Error updating transaction:', updateError);
      throw new Error("Failed to update transaction status");
    }

    console.log('✅ [MARK-PAYMENT] Transaction marked as paid successfully');

    // Log activity for funds blocked
    try {
      // Log for the buyer
      await adminClient
        .from('activity_logs')
        .insert({
          user_id: transaction.buyer_id,
          activity_type: 'funds_blocked',
          title: 'Fonds bloqués en séquestre',
          description: `${transaction.price} ${transaction.currency} bloqués pour la transaction "${transaction.title}"`,
          metadata: {
            transaction_id: transaction.id,
            amount: transaction.price,
            currency: transaction.currency
          }
        });

      // Log for the seller  
      await adminClient
        .from('activity_logs')
        .insert({
          user_id: transaction.user_id,
          activity_type: 'funds_blocked',
          title: 'Paiement reçu et bloqué',
          description: `${transaction.price} ${transaction.currency} reçus et bloqués en attente de validation pour "${transaction.title}"`,
          metadata: {
            transaction_id: transaction.id,
            amount: transaction.price,
            currency: transaction.currency
          }
        });
    } catch (logError) {
      console.error('❌ [MARK-PAYMENT] Error logging activity:', logError);
    }

    // Mock notifications
    console.log(`📧 [MARK-PAYMENT] EMAIL: Payment authorized for ${transaction.title}`);
    console.log(`📱 [MARK-PAYMENT] SMS: ${transaction.price} ${transaction.currency} blocked in escrow`);

    return new Response(JSON.stringify({ 
      success: true,
      message: "Payment authorized and transaction updated"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("❌ [MARK-PAYMENT] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});