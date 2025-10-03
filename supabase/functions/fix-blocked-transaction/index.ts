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

  try {
    const { transactionId, paymentIntentId } = await req.json();

    if (!transactionId) {
      throw new Error("Transaction ID is required");
    }

    // Create admin client
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    logger.log(`[FIX-TRANSACTION] Starting fix for transaction: ${transactionId}`);

    // Update status first
    const { error: statusError } = await adminClient
      .from("transactions")
      .update({ 
        status: 'paid'
      })
      .eq("id", transactionId);

    if (statusError) {
      throw new Error(`Failed to update status: ${statusError.message}`);
    }

    // Update payment intent ID if provided
    if (paymentIntentId) {
      const { error: paymentError } = await adminClient
        .from("transactions")
        .update({ 
          stripe_payment_intent_id: paymentIntentId
        })
        .eq("id", transactionId);

      if (paymentError) {
        logger.log(`[FIX-TRANSACTION] Warning: Could not update payment intent ID: ${paymentError.message}`);
      }
    }

    // Update timestamps
    const { error: timestampError } = await adminClient
      .from("transactions")
      .update({ 
        payment_blocked_at: new Date().toISOString(),
        validation_deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48 hours
        updated_at: new Date().toISOString()
      })
      .eq("id", transactionId);

    if (timestampError) {
      logger.log(`[FIX-TRANSACTION] Warning: Could not update timestamps: ${timestampError.message}`);
    }

    logger.log(`[FIX-TRANSACTION] Successfully fixed transaction: ${transactionId}`);

    return new Response(JSON.stringify({ 
      success: true,
      message: "Transaction fixed successfully",
      transactionId
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[FIX-TRANSACTION] Error:`, errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});