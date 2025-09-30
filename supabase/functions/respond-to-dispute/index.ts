import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper logging function for debugging
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[RESPOND-TO-DISPUTE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    logStep("Function started");

    // Get user from auth header
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      logStep("Authentication failed", userError);
      throw new Error("User not authenticated");
    }

    logStep("User authenticated", { userId: user.id });

    // Parse request body
    const { disputeId, response } = await req.json();
    
    if (!disputeId || !response?.trim()) {
      throw new Error("Missing required fields: disputeId and response");
    }

    logStep("Processing dispute response", { disputeId, responseLength: response.length });

    // Get dispute without join (avoid FK relationship error)
    const { data: dispute, error: disputeError } = await supabase
      .from("disputes")
      .select("*")
      .eq("id", disputeId)
      .single();

    if (disputeError || !dispute) {
      logStep("Dispute not found", disputeError);
      throw new Error("Dispute not found");
    }

    // Get transaction separately
    const { data: transaction, error: transactionError } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", dispute.transaction_id)
      .single();

    if (transactionError || !transaction) {
      logStep("Transaction not found", transactionError);
      throw new Error("Transaction not found");
    }
    
    // Verify user is the seller of the transaction
    if (transaction.user_id !== user.id) {
      logStep("Unauthorized - user is not the seller", { 
        userId: user.id, 
        sellerId: transaction.user_id 
      });
      throw new Error("Only the seller can respond to this dispute");
    }

    // Update dispute with seller response
    const { error: updateError } = await supabase
      .from("disputes")
      .update({
        resolution: response.trim(),
        status: 'responded',
        updated_at: new Date().toISOString()
      })
      .eq("id", disputeId);

    if (updateError) {
      logStep("Error updating dispute", updateError);
      throw updateError;
    }

    logStep("Dispute updated successfully");

    // Log activity
    const { error: activityError } = await supabase
      .from('activity_logs')
      .insert({
        user_id: user.id,
        activity_type: 'dispute_created', // We can reuse this type or create a new one
        title: `Réponse au litige sur "${transaction.title}"`,
        description: `Le vendeur a répondu au litige`,
        metadata: {
          dispute_id: disputeId,
          transaction_id: transaction.id,
          response_length: response.length
        }
      });

    if (activityError) {
      logStep("Error logging activity", activityError);
    }

    // Send notification to the reporter (buyer who created the dispute)
    try {
      const { error: notificationError } = await supabase.functions.invoke('send-notifications', {
        body: {
          type: 'dispute_response',
          transactionId: transaction.id,
          message: `Le vendeur a répondu à votre litige concernant "${transaction.title}". Consultez la transaction pour voir la réponse.`,
          recipients: [dispute.reporter_id]
        }
      });
      
      if (notificationError) {
        logStep("Error sending notification", notificationError);
      } else {
        logStep("Notification sent to dispute reporter");
      }
    } catch (error) {
      logStep("Error invoking notification function", error);
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: "Response submitted successfully"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    logStep("ERROR", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});