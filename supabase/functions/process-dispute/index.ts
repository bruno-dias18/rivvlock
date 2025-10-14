import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { logger } from "../_shared/logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Production-safe logging for critical operations
// Uses console.log directly (bypasses _shared/logger) to ensure visibility in production logs
const logStep = (step: string, details?: any) => {
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ` | ${JSON.stringify(details)}` : '';
  console.log(`[PROCESS-DISPUTE ${timestamp}] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { disputeId, action, adminNotes, refundPercentage = 100 } = await req.json();
    logStep("START", { disputeId, action });
    
    if (action === 'refund' && (refundPercentage < 0 || refundPercentage > 100)) {
      throw new Error("refundPercentage must be between 0 and 100");
    }

    // Create user client for authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    logStep("AUTH_HEADER_OK");

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Verify user is authenticated
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) {
      throw new Error("User not authenticated");
    }
    logStep("USER_AUTHENTICATED", { userId: user.id });

    // Verify user is admin
    const { data: isAdmin, error: adminCheckError } = await userClient.rpc('is_admin', { check_user_id: user.id });
    if (adminCheckError || !isAdmin) {
      throw new Error("Unauthorized: Admin access required");
    }
    logStep("ADMIN_VERIFIED");

    // Create admin client for database operations
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get dispute and related transaction
    const { data: dispute, error: disputeError } = await adminClient
      .from("disputes")
      .select(`
        *,
        transactions (*)
      `)
      .eq("id", disputeId)
      .single();

    if (disputeError || !dispute) {
      throw new Error("Dispute not found");
    }

    const transaction = dispute.transactions;
    logStep("DISPUTE_LOADED", { disputeId, transactionId: transaction.id, piId: transaction.stripe_payment_intent_id });
    if (!transaction.stripe_payment_intent_id) {
      throw new Error("No payment intent found for this transaction");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-06-20",
    });

    // Retrieve current PaymentIntent status to choose safe action
    const paymentIntent = await stripe.paymentIntents.retrieve(transaction.stripe_payment_intent_id);

    let result;
    let newTransactionStatus;
    let disputeStatus;

    const totalAmount = Math.round(transaction.price * 100);
    const platformFee = Math.round(totalAmount * 0.05);
    const currency = String(transaction.currency).toLowerCase();

    if (action === 'refund') {
      // Admin refund with partial support
      const refundAmount = Math.round((totalAmount * refundPercentage) / 100);
      const sellerAmount = totalAmount - refundAmount - platformFee;
      
      if (paymentIntent.status === 'requires_capture') {
        await stripe.paymentIntents.cancel(transaction.stripe_payment_intent_id);
        
        if (refundPercentage < 100 && sellerAmount > 0) {
          const { data: sellerAccount } = await adminClient
            .from('stripe_accounts')
            .select('stripe_account_id')
            .eq('user_id', transaction.user_id)
            .maybeSingle();

          if (sellerAccount?.stripe_account_id) {
            await stripe.transfers.create({
              amount: sellerAmount,
              currency,
              destination: sellerAccount.stripe_account_id,
              transfer_group: `txn_${transaction.id}`,
              metadata: { dispute_id: dispute.id, type: 'partial_refund_seller_share', refund_percentage: refundPercentage }
            });
          }
        }
      } else if (paymentIntent.status === 'succeeded') {
        await stripe.refunds.create({
          payment_intent: transaction.stripe_payment_intent_id,
          amount: refundAmount,
          reason: 'requested_by_customer',
          metadata: { 
            dispute_id: dispute.id, 
            admin_official: 'true', 
            type: refundPercentage === 100 ? 'admin_full_refund' : 'admin_partial_refund',
            refund_percentage: refundPercentage
          }
        });
        
        if (refundPercentage < 100 && sellerAmount > 0) {
          const { data: sellerAccount } = await adminClient
            .from('stripe_accounts')
            .select('stripe_account_id')
            .eq('user_id', transaction.user_id)
            .maybeSingle();

          if (sellerAccount?.stripe_account_id) {
            await stripe.transfers.create({
              amount: sellerAmount,
              currency,
              destination: sellerAccount.stripe_account_id,
              transfer_group: `txn_${transaction.id}`,
              metadata: { dispute_id: dispute.id, type: 'partial_refund_seller_share', refund_percentage: refundPercentage }
            });
          }
        }
      } else {
        throw new Error(`PaymentIntent not refundable in status: ${paymentIntent.status}`);
      }

      newTransactionStatus = 'disputed';
      disputeStatus = 'resolved_refund';

    } else if (action === 'release') {
      const { data: sellerAccount } = await adminClient
        .from('stripe_accounts')
        .select('stripe_account_id')
        .eq('user_id', transaction.user_id)
        .maybeSingle();

      if (!sellerAccount?.stripe_account_id) {
        throw new Error('Seller Stripe account not found');
      }

      if (paymentIntent.status === 'requires_capture') {
        await stripe.paymentIntents.capture(transaction.stripe_payment_intent_id);
        logStep("STRIPE_CAPTURE_OK");
      } else if (paymentIntent.status !== 'succeeded') {
        throw new Error(`PaymentIntent not capturable in status: ${paymentIntent.status}`);
      }

      const transferAmount = totalAmount - platformFee;
      if (transferAmount > 0) {
        await stripe.transfers.create({
          amount: transferAmount,
          currency,
          destination: sellerAccount.stripe_account_id,
          transfer_group: `txn_${transaction.id}`,
          metadata: { dispute_id: dispute.id, type: 'admin_release_transfer' }
        });
        logStep("STRIPE_TRANSFER_OK", { amount: transferAmount, destination: sellerAccount.stripe_account_id });
      }

      newTransactionStatus = 'validated';
      disputeStatus = 'resolved_release';
    } else {
      throw new Error("Invalid action. Must be 'refund' or 'release'");
    }

    // Update dispute status (using admin client)
    const resolutionText = action === 'refund' 
      ? `Décision administrative: ${refundPercentage === 100 ? 'full_refund' : 'partial_refund'} - ${refundPercentage}% refund`
      : `Décision administrative: no_refund - 0% refund`;
    
    const { error: disputeUpdateError } = await adminClient
      .from("disputes")
      .update({ 
        status: disputeStatus,
        resolved_at: new Date().toISOString(),
        resolution: resolutionText,
        updated_at: new Date().toISOString()
      })
      .eq("id", disputeId);

    if (disputeUpdateError) {
      logger.error("Error updating dispute:", disputeUpdateError);
      throw disputeUpdateError;
    }
    logStep("DISPUTE_UPDATE_OK", { newStatus: disputeStatus });

    // Save admin notes in separate table if provided
    if (adminNotes) {
      const { error: notesError } = await adminClient
        .from("admin_dispute_notes")
        .insert({
          dispute_id: disputeId,
          admin_user_id: user.id,
          notes: adminNotes
        });

      if (notesError) {
        logger.error("Error saving admin notes:", notesError);
        // Don't throw - notes are not critical
      }
    }

    // Update transaction status (using admin client)
    const transactionUpdate: any = {
      status: newTransactionStatus,
      funds_released: action === 'release',
      funds_released_at: action === 'release' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };

    // Add refund status based on percentage
    if (action === 'refund') {
      transactionUpdate.refund_status = refundPercentage === 100 ? 'full' : 'partial';
      transactionUpdate.refund_amount = Math.round((transaction.price * refundPercentage) / 100);
    }

    const { error: transactionUpdateError } = await adminClient
      .from("transactions")
      .update(transactionUpdate)
      .eq("id", transaction.id);

    if (transactionUpdateError) {
      logger.error("Error updating transaction:", transactionUpdateError);
      throw transactionUpdateError;
    }
    logStep("TRANSACTION_UPDATE_OK", { newStatus: newTransactionStatus });

    logStep("SUCCESS", { action, disputeStatus, transactionStatus: newTransactionStatus });
    return new Response(JSON.stringify({
      success: true,
      action: action,
      dispute_status: disputeStatus,
      transaction_status: newTransactionStatus
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    logger.error("Error processing dispute:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { error: errorMessage, stack: error instanceof Error ? error.stack : undefined });
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      details: "Check Edge Function logs for full trace"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
