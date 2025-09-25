import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const { type, transactionId, message, recipients } = await req.json();
    
    console.log("Sending notification:", type, "for transaction:", transactionId);

    // Get transaction details for context
    if (transactionId) {
      const { data: transaction, error } = await supabaseClient
        .from("transactions")
        .select("*")
        .eq("id", transactionId)
        .single();

      if (!error && transaction) {
        console.log(`📧 EMAIL NOTIFICATION [${type}]:`, message);
        console.log(`   Transaction: ${transaction.title}`);
        console.log(`   Amount: ${transaction.price} ${transaction.currency}`);
        console.log(`   Recipients:`, recipients);
        
        console.log(`📱 SMS NOTIFICATION [${type}]:`, message);
        console.log(`   Service: ${transaction.title}`);
        
        // Mock different notification types
        switch (type) {
          case 'payment_reminder_7d':
            console.log(`⏰ REMINDER: Payment due in 7 days for ${transaction.title}`);
            break;
          case 'payment_reminder_24h':
            console.log(`🚨 URGENT: Payment due in 24 hours for ${transaction.title}`);
            break;
          case 'validation_reminder_7d':
            console.log(`✅ REMINDER: Validation period ends in 7 days for ${transaction.title}`);
            break;
          case 'validation_reminder_24h':
            console.log(`⚠️ URGENT: Validation period ends in 24 hours for ${transaction.title}`);
            break;
          case 'dispute_created':
            console.log(`🚩 ADMIN ALERT: New dispute created for ${transaction.title}`);
            break;
          case 'funds_released':
            console.log(`💰 SUCCESS: Funds released for ${transaction.title}`);
            break;
          default:
            console.log(`📬 NOTIFICATION: ${message}`);
        }
      }
    } else {
      // Generic notification without transaction
      console.log(`📧 EMAIL NOTIFICATION [${type}]:`, message);
      console.log(`📱 SMS NOTIFICATION [${type}]:`, message);
    }

    // Log to help track notification history
    console.log(`NOTIFICATION SENT: ${new Date().toISOString()} - Type: ${type}`);

    return new Response(JSON.stringify({ 
      success: true,
      type: type,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error sending notification:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});