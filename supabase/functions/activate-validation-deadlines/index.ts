import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
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
    logger.log("⏰ [ACTIVATE-VALIDATION-DEADLINES] Starting deadline activation process");

    const now = new Date();
    
    // Find transactions that need validation deadline activation
    // - seller_validated = true
    // - COALESCE(service_end_date, service_date) <= now (use end date if exists, otherwise start date)
    // - validation_deadline IS NULL
    // - buyer_validated = false
    // - funds_released = false
    // - status = 'paid'
    const { data: transactions, error: fetchError } = await adminClient
      .from("transactions")
      .select("*")
      .eq("seller_validated", true)
      .eq("buyer_validated", false)
      .eq("funds_released", false)
      .eq("status", "paid")
      .is("validation_deadline", null);

    if (fetchError) {
      logger.error("❌ [ACTIVATE-VALIDATION-DEADLINES] Error fetching transactions:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Filter transactions where service_end_date (or service_date) + 2h grace period has passed
    const filteredTransactions = transactions?.filter(t => {
      const referenceDate = new Date(t.service_end_date || t.service_date);
      const gracePeriodEnd = new Date(referenceDate.getTime() + 2 * 60 * 60 * 1000); // +2h grace period
      return gracePeriodEnd <= now;
    }) || [];

    if (!filteredTransactions || filteredTransactions.length === 0) {
      logger.log("ℹ️ [ACTIVATE-VALIDATION-DEADLINES] No transactions found that need deadline activation");
      return new Response(JSON.stringify({ 
        success: true,
        deadlinesActivated: 0
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logger.log(`📋 [ACTIVATE-VALIDATION-DEADLINES] Found ${filteredTransactions.length} transactions to activate deadlines`);

    let activatedCount = 0;

    // Process each transaction
    for (const transaction of filteredTransactions) {
      try {
        // Set validation deadline to 48 hours from now
        const validationDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000);

        const { error: updateError } = await adminClient
          .from("transactions")
          .update({
            validation_deadline: validationDeadline.toISOString()
          })
          .eq("id", transaction.id);

        if (updateError) {
          logger.error(`❌ [ACTIVATE-VALIDATION-DEADLINES] Error updating transaction ${transaction.id}:`, updateError);
          continue;
        }

        // Send notification to buyer about deadline activation
        await adminClient.functions.invoke('send-notifications', {
          body: {
            type: 'validation_deadline_activated',
            transactionId: transaction.id,
            message: `🎯 Le service "${transaction.title}" a été livré ! Vous avez maintenant 48 heures pour valider la libération des fonds. Montant : ${transaction.price} ${transaction.currency}.`,
            recipients: [transaction.buyer_id].filter(Boolean)
          }
        });

        logger.log(`✅ [ACTIVATE-VALIDATION-DEADLINES] Activated deadline for transaction ${transaction.id}`);
        activatedCount++;

      } catch (error) {
        logger.error(`❌ [ACTIVATE-VALIDATION-DEADLINES] Error processing transaction ${transaction.id}:`, error);
      }
    }

    logger.log(`🏁 [ACTIVATE-VALIDATION-DEADLINES] Processing complete. Total deadlines activated: ${activatedCount}`);

    return new Response(JSON.stringify({ 
      success: true,
      deadlinesActivated: activatedCount
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("❌ [ACTIVATE-VALIDATION-DEADLINES] Function error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});