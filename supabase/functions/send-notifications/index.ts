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

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const { type, transactionId, message, recipients } = await req.json();
    
    logger.log("Sending notification:", type, "for transaction:", transactionId);

    // Get transaction details for context
    if (transactionId) {
      const { data: transaction, error } = await supabaseClient
        .from("transactions")
        .select("*")
        .eq("id", transactionId)
        .single();

      if (!error && transaction) {
        logger.log(`📧 EMAIL NOTIFICATION [${type}]:`, message);
        logger.log(`   Transaction: ${transaction.title}`);
        logger.log(`   Amount: ${transaction.price} ${transaction.currency}`);
        logger.log(`   Recipients:`, recipients);
        
        logger.log(`📱 SMS NOTIFICATION [${type}]:`, message);
        logger.log(`   Service: ${transaction.title}`);
        
        // Mock different notification types
        switch (type) {
          case 'payment_reminder_7d':
            logger.log(`⏰ REMINDER: Payment due in 7 days for ${transaction.title}`);
            break;
          case 'payment_reminder_24h':
            logger.log(`🚨 URGENT: Payment due in 24 hours for ${transaction.title}`);
            break;
          case 'validation_reminder_7d':
            logger.log(`✅ REMINDER: Validation period ends in 7 days for ${transaction.title}`);
            break;
          case 'validation_reminder_24h':
            logger.log(`⚠️ URGENT: Validation period ends in 24 hours for ${transaction.title}`);
            break;
          case 'dispute_created':
            logger.log(`🚩 ADMIN ALERT: New dispute created for ${transaction.title}`);
            break;
          case 'funds_released':
            logger.log(`💰 SUCCESS: Funds released for ${transaction.title}`);
            break;
          default:
            logger.log(`📬 NOTIFICATION: ${message}`);
        }
      }
    } else {
      // Generic notification without transaction
      logger.log(`📧 EMAIL NOTIFICATION [${type}]:`, message);
      logger.log(`📱 SMS NOTIFICATION [${type}]:`, message);
    }

    // Log to help track notification history
    logger.log(`NOTIFICATION SENT: ${new Date().toISOString()} - Type: ${type}`);

    return new Response(JSON.stringify({ 
      success: true,
      type: type,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    logger.error("Error sending notification:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});