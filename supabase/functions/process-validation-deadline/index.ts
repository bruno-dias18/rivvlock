import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Admin client for database operations
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    console.log("🕐 [PROCESS-VALIDATION-DEADLINE] Starting deadline processing");

    // Find transactions where validation deadline has passed and funds not released
    // Only process transactions that have an active validation deadline
    const { data: expiredTransactions, error: fetchError } = await adminClient
      .from("transactions")
      .select("*")
      .eq("seller_validated", true)
      .eq("buyer_validated", false)
      .eq("funds_released", false)
      .not("validation_deadline", "is", null)
      .lt("validation_deadline", new Date().toISOString())
      .eq("status", "paid");

    if (fetchError) {
      console.error("❌ [PROCESS-VALIDATION-DEADLINE] Error fetching expired transactions:", fetchError);
      throw new Error("Failed to fetch expired transactions");
    }

    if (!expiredTransactions || expiredTransactions.length === 0) {
      console.log("ℹ️ [PROCESS-VALIDATION-DEADLINE] No expired transactions found");
      return new Response(JSON.stringify({ 
        success: true,
        processed: 0,
        message: "No expired transactions to process"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    console.log(`📋 [PROCESS-VALIDATION-DEADLINE] Found ${expiredTransactions.length} expired transactions`);

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    let processedCount = 0;
    let errorCount = 0;

    // Process each expired transaction
    for (const transaction of expiredTransactions) {
      try {
        console.log(`💰 [PROCESS-VALIDATION-DEADLINE] Processing transaction ${transaction.id}`);

        if (!transaction.stripe_payment_intent_id) {
          console.error(`❌ [PROCESS-VALIDATION-DEADLINE] No payment intent for transaction ${transaction.id}`);
          errorCount++;
          continue;
        }

        // Capture the payment intent
        const paymentIntent = await stripe.paymentIntents.capture(
          transaction.stripe_payment_intent_id
        );

        if (paymentIntent.status === "succeeded") {
          // Update transaction to mark funds as released and buyer as validated
          const { error: updateError } = await adminClient
            .from("transactions")
            .update({
              funds_released: true,
              buyer_validated: true, // Auto-validate since deadline passed
              updated_at: new Date().toISOString()
            })
            .eq("id", transaction.id);

          if (updateError) {
            console.error(`❌ [PROCESS-VALIDATION-DEADLINE] Error updating transaction ${transaction.id}:`, updateError);
            errorCount++;
            continue;
          }

          // Send notification about automatic fund release
          await adminClient.functions.invoke('send-notifications', {
            body: {
              type: 'automatic_fund_release',
              transactionId: transaction.id,
              message: `Les fonds ont été libérés automatiquement suite à l'expiration du délai de validation (48h).`,
              recipients: [transaction.user_id, transaction.buyer_id].filter(Boolean)
            }
          });

          console.log(`✅ [PROCESS-VALIDATION-DEADLINE] Successfully processed transaction ${transaction.id}`);
          processedCount++;
        } else {
          console.error(`❌ [PROCESS-VALIDATION-DEADLINE] Payment capture failed for transaction ${transaction.id}:`, paymentIntent.status);
          errorCount++;
        }

      } catch (error) {
        console.error(`❌ [PROCESS-VALIDATION-DEADLINE] Error processing transaction ${transaction.id}:`, error);
        errorCount++;
      }
    }

    console.log(`🏁 [PROCESS-VALIDATION-DEADLINE] Processing complete. Processed: ${processedCount}, Errors: ${errorCount}`);

    return new Response(JSON.stringify({ 
      success: true,
      processed: processedCount,
      errors: errorCount,
      total: expiredTransactions.length
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("❌ [PROCESS-VALIDATION-DEADLINE] Function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});