import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { logger } from "../_shared/logger.ts";

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
    const now = new Date().toISOString();
    logger.log("🕐 [PROCESS-VALIDATION-DEADLINE] Starting deadline processing");
    logger.log(`📅 Current time (ISO): ${now}`);

    // Find transactions where validation deadline has passed and funds not released
    // Only process transactions that have an active validation deadline
    const { data: expiredTransactions, error: fetchError } = await adminClient
      .from("transactions")
      .select("*")
      .eq("seller_validated", true)
      .eq("buyer_validated", false)
      .eq("funds_released", false)
      .not("validation_deadline", "is", null)
      .lt("validation_deadline", now)
      .eq("status", "paid");

    if (fetchError) {
      logger.error("❌ [PROCESS-VALIDATION-DEADLINE] Error fetching expired transactions:", fetchError);
      throw new Error("Failed to fetch expired transactions");
    }

    const foundCount = expiredTransactions?.length || 0;
    logger.log(`📋 [PROCESS-VALIDATION-DEADLINE] Found ${foundCount} expired transactions`);

    if (foundCount > 0) {
      logger.log("📝 Transaction details:");
      expiredTransactions.forEach(t => {
        logger.log(`  - ID: ${t.id}, Title: "${t.title}", Deadline: ${t.validation_deadline}, PaymentIntent: ${t.stripe_payment_intent_id}`);
      });
    }

    if (foundCount === 0) {
      logger.log("ℹ️ [PROCESS-VALIDATION-DEADLINE] No expired transactions found");
      return new Response(JSON.stringify({
        success: true,
        found: 0,
        processed: 0,
        errors: 0,
        transactionIds: [],
        message: "No expired transactions to process"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-06-20",
    });

    let processedCount = 0;
    let errorCount = 0;
    const transactionIds: string[] = [];

    // Process each expired transaction
    for (const transaction of expiredTransactions) {
      try {
        logger.log(`\n💰 [PROCESS-VALIDATION-DEADLINE] Processing transaction ${transaction.id}`);
        logger.log(`   Title: "${transaction.title}"`);
        logger.log(`   Deadline: ${transaction.validation_deadline}`);

        if (!transaction.stripe_payment_intent_id) {
          logger.error(`❌ [PROCESS-VALIDATION-DEADLINE] No payment intent for transaction ${transaction.id}`);
          errorCount++;
          continue;
        }

        logger.log(`   Payment Intent ID: ${transaction.stripe_payment_intent_id}`);
        logger.log(`   Attempting Stripe capture...`);

        // Capture the payment intent
        const paymentIntent = await stripe.paymentIntents.capture(
          transaction.stripe_payment_intent_id
        );

        logger.log(`   Stripe response status: ${paymentIntent.status}`);

        if (paymentIntent.status === "succeeded") {
          logger.log(`✅ [PROCESS-VALIDATION-DEADLINE] Payment captured successfully for transaction ${transaction.id}`);
          
          logger.log(`   Updating database...`);
          // Update transaction to mark funds as released, buyer as validated, and status as completed
          const { error: updateError } = await adminClient
            .from("transactions")
            .update({
              funds_released: true,
              buyer_validated: true, // Auto-validate since deadline passed
              status: 'completed',
              funds_released_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq("id", transaction.id);

          if (updateError) {
            logger.error(`❌ [PROCESS-VALIDATION-DEADLINE] Error updating transaction ${transaction.id}:`, updateError);
            logger.error(`   Update error details:`, JSON.stringify(updateError));
            errorCount++;
            continue;
          }

          logger.log(`   Database updated successfully`);
          logger.log(`   Sending notification...`);

          // Send notification about automatic fund release
          await adminClient.functions.invoke('send-notifications', {
            body: {
              type: 'automatic_fund_release',
              transactionId: transaction.id,
              message: `Les fonds ont été libérés automatiquement suite à l'expiration du délai de validation (48h).`,
              recipients: [transaction.user_id, transaction.buyer_id].filter(Boolean)
            }
          });

          logger.log(`   Notification sent`);
          transactionIds.push(transaction.id);
          logger.log(`✅✅✅ [PROCESS-VALIDATION-DEADLINE] Successfully processed transaction ${transaction.id}\n`);
          processedCount++;
        } else {
          logger.error(`❌ [PROCESS-VALIDATION-DEADLINE] Payment capture failed for transaction ${transaction.id}:`, paymentIntent.status);
          errorCount++;
        }

      } catch (error) {
        logger.error(`❌❌❌ [PROCESS-VALIDATION-DEADLINE] Error processing transaction ${transaction.id}:`, error);
        if (error instanceof Error) {
          logger.error(`   Error message: ${error.message}`);
          logger.error(`   Error stack: ${error.stack}`);
        }
        errorCount++;
      }
    }

    logger.log(`\n🏁 [PROCESS-VALIDATION-DEADLINE] ===== PROCESSING COMPLETE =====`);
    logger.log(`   Found: ${foundCount}`);
    logger.log(`   Successfully processed: ${processedCount}`);
    logger.log(`   Errors: ${errorCount}`);
    logger.log(`   Transaction IDs processed: ${transactionIds.join(', ') || 'none'}`);
    logger.log(`============================================\n`);

    return new Response(JSON.stringify({ 
      success: true,
      found: foundCount,
      processed: processedCount,
      errors: errorCount,
      transactionIds: transactionIds
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    logger.error("❌❌❌ [PROCESS-VALIDATION-DEADLINE] FATAL FUNCTION ERROR:", error);
    if (error instanceof Error) {
      logger.error(`   Error message: ${error.message}`);
      logger.error(`   Error stack: ${error.stack}`);
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage,
      found: 0,
      processed: 0,
      errors: 1,
      transactionIds: []
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});