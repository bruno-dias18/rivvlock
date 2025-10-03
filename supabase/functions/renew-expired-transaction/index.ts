import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { logger } from "../_shared/logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  logger.log(`[RENEW-TRANSACTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("User not authenticated");
    }
    logStep("User authenticated", { userId: user.id });

    const { transactionId, newServiceDate, newServiceEndDate, message } = await req.json();
    
    if (!transactionId) {
      throw new Error("Transaction ID is required");
    }
    logStep("Request parameters received", { transactionId, newServiceDate, newServiceEndDate, message });

    // Fetch the transaction
    const { data: transaction, error: fetchError } = await supabaseClient
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (fetchError || !transaction) {
      throw new Error("Transaction not found");
    }
    logStep("Transaction fetched", { status: transaction.status, renewalCount: transaction.renewal_count });

    // Verify user is the seller
    if (transaction.user_id !== user.id) {
      throw new Error("Only the seller can renew this transaction");
    }

    // Verify transaction is expired or has an expired payment deadline
    const now = new Date();
    const paymentDeadline = transaction.payment_deadline ? new Date(transaction.payment_deadline) : null;
    const isPaymentExpired = paymentDeadline && paymentDeadline < now;
    
    if (transaction.status !== "expired" && !isPaymentExpired) {
      throw new Error("Only expired transactions or transactions with expired payment deadlines can be renewed");
    }
    
    // If transaction is pending but payment is expired, log it
    if (transaction.status === "pending" && isPaymentExpired) {
      logStep("Renewing pending transaction with expired payment deadline", { 
        status: transaction.status, 
        paymentDeadline: transaction.payment_deadline 
      });
    }

    // Check renewal limit (max 2 renewals)
    const MAX_RENEWALS = 2;
    if (transaction.renewal_count >= MAX_RENEWALS) {
      throw new Error(`Maximum number of renewals (${MAX_RENEWALS}) reached`);
    }

    // Calculate new payment deadline (48 hours from now)
    const newPaymentDeadline = new Date();
    newPaymentDeadline.setHours(newPaymentDeadline.getHours() + 48);
    logStep("New payment deadline calculated", { deadline: newPaymentDeadline.toISOString() });

    // Prepare update data
    const updateData: any = {
      status: "pending",
      payment_deadline: newPaymentDeadline.toISOString(),
      renewal_count: transaction.renewal_count + 1,
      updated_at: new Date().toISOString(),
    };

    // Add new service date if provided - use approval system
    if (newServiceDate) {
      updateData.proposed_service_date = newServiceDate;
      updateData.date_change_status = 'pending_approval';
      updateData.date_change_count = (transaction.date_change_count || 0) + 1;
      updateData.date_change_requested_at = new Date().toISOString();
      
      // Also add proposed_service_end_date if provided
      if (newServiceEndDate) {
        updateData.proposed_service_end_date = newServiceEndDate;
      }
      
      if (message) {
        updateData.date_change_message = message;
      }
      logStep("New service date proposed for approval", { 
        proposedDate: newServiceDate,
        proposedEndDate: newServiceEndDate,
        changeCount: updateData.date_change_count 
      });
    }

    // Update the transaction
    const { data: updatedTransaction, error: updateError } = await supabaseClient
      .from("transactions")
      .update(updateData)
      .eq("id", transactionId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update transaction: ${updateError.message}`);
    }
    logStep("Transaction renewed successfully", { 
      newStatus: updatedTransaction.status,
      renewalCount: updatedTransaction.renewal_count 
    });

    // Log activity
    const activityMessage = message 
      ? `Transaction relancée par le vendeur. Message: ${message}`
      : "Transaction relancée par le vendeur";

    await supabaseClient.from("activity_logs").insert({
      user_id: user.id,
      activity_type: "transaction_created",
      title: "Transaction relancée",
      description: activityMessage,
      metadata: {
        transaction_id: transactionId,
        renewal_count: updatedTransaction.renewal_count,
        new_payment_deadline: newPaymentDeadline.toISOString(),
        new_service_date: newServiceDate || null,
      },
    });
    logStep("Activity logged");

    return new Response(
      JSON.stringify({
        success: true,
        transaction: updatedTransaction,
        message: "Transaction renewed successfully",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
