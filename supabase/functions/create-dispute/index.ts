import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-DISPUTE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.id) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const { transactionId, disputeType, reason } = await req.json();
    if (!transactionId || !reason) {
      throw new Error("Transaction ID and reason are required");
    }
    logStep("Request data parsed", { transactionId, disputeType, reason });

    // Verify user is part of the transaction and it's in paid status
    const { data: transaction, error: transactionError } = await supabaseClient
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .or(`user_id.eq.${user.id},buyer_id.eq.${user.id}`)
      .eq("status", "paid")
      .single();

    if (transactionError || !transaction) {
      throw new Error("Transaction not found or not authorized");
    }
    logStep("Transaction verified", { transactionId });

    // Check if dispute already exists for this transaction
    const { data: existingDispute } = await supabaseClient
      .from("disputes")
      .select("id")
      .eq("transaction_id", transactionId)
      .eq("status", "open")
      .single();

    if (existingDispute) {
      throw new Error("A dispute already exists for this transaction");
    }

    // Create the dispute with 48h deadline
    const disputeDeadline = new Date();
    disputeDeadline.setHours(disputeDeadline.getHours() + 48);

    const { data: dispute, error: disputeError } = await supabaseClient
      .from("disputes")
      .insert({
        transaction_id: transactionId,
        reporter_id: user.id,
        dispute_type: disputeType || "quality_issue",
        reason: reason,
        status: "open",
        dispute_deadline: disputeDeadline.toISOString(),
      })
      .select()
      .single();

    if (disputeError) {
      throw new Error(`Failed to create dispute: ${disputeError.message}`);
    }
    logStep("Dispute created", { disputeId: dispute.id });

    // Update transaction status to 'disputed'
    const { error: updateError } = await supabaseClient
      .from('transactions')
      .update({ status: 'disputed' })
      .eq('id', transactionId);

    if (updateError) {
      logStep("Error updating transaction status", updateError);
      // Don't throw here, dispute is already created
    } else {
      logStep("Transaction status updated to disputed");
    }

    // Log activity
    const { error: activityError } = await supabaseClient
      .from('activity_logs')
      .insert({
        user_id: user.id,
        activity_type: 'dispute_created',
        title: `Litige créé pour "${transaction.title}"`,
        description: `Type: ${disputeType}, Raison: ${reason}`,
        metadata: {
          dispute_id: dispute.id,
          transaction_id: transactionId,
          dispute_type: disputeType
        }
      });

    if (activityError) {
      logStep("Error logging activity", activityError);
    }

    // Send notification to seller via send-notifications function
    try {
      const { error: notificationError } = await supabaseClient.functions.invoke('send-notifications', {
        body: {
          type: 'dispute_created',
          transactionId: transactionId,
          message: `Un client a ouvert un litige sur votre transaction "${transaction.title}". Type: ${disputeType}`,
          recipients: [transaction.user_id] // Seller ID
        }
      });
      
      if (notificationError) {
        logStep("Error sending notification", notificationError);
      } else {
        logStep("Notification sent to seller");
      }
    } catch (error) {
      logStep("Error invoking notification function", error);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Dispute created successfully",
        disputeId: dispute.id
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});