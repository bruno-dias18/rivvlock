import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
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
    const { disputeId, action, adminNotes } = await req.json(); // action: 'refund' or 'release'
    
    logger.log("Processing dispute:", disputeId, "Action:", action);

    // Create user client for authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user is authenticated
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    // Verify user is admin
    const { data: isAdmin, error: adminCheckError } = await userClient.rpc('is_admin', { check_user_id: user.id });
    if (adminCheckError || !isAdmin) {
      throw new Error("Unauthorized: Admin access required");
    }

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
      // Admin refund: 
      // - If still authorized (requires_capture) -> cancel PI
      // - If already captured (succeeded) -> create a full refund
      if (paymentIntent.status === 'requires_capture') {
        result = await stripe.paymentIntents.cancel(transaction.stripe_payment_intent_id);
        logger.log(`✅ Authorization cancelled - ${(totalAmount / 100).toFixed(2)} ${transaction.currency} returned to buyer`);
      } else if (paymentIntent.status === 'succeeded') {
        await stripe.refunds.create({
          payment_intent: transaction.stripe_payment_intent_id,
          amount: totalAmount,
          reason: 'requested_by_customer',
          metadata: { dispute_id: dispute.id, admin_official: 'true', type: 'admin_full_refund' }
        });
        logger.log(`✅ Full refund created - ${(totalAmount / 100).toFixed(2)} ${transaction.currency}`);
      } else {
        throw new Error(`PaymentIntent not refundable in status: ${paymentIntent.status}`);
      }

      newTransactionStatus = 'disputed';
      disputeStatus = 'resolved_refund';

    } else if (action === 'release') {
      // Admin release: capture funds (if not already) then transfer seller share
      // Find seller's connected account
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
      }

      newTransactionStatus = 'completed';
      disputeStatus = 'resolved_release';

      logger.log(`💰 RELEASE: ${((transferAmount) / 100).toFixed(2)} ${transaction.currency} released to seller`);
    } else {
      throw new Error("Invalid action. Must be 'refund' or 'release'");
    }

    // Update dispute status (using admin client)
    const { error: disputeUpdateError } = await adminClient
      .from("disputes")
      .update({ 
        status: disputeStatus,
        resolved_at: new Date().toISOString(),
        admin_notes: adminNotes,
        updated_at: new Date().toISOString()
      })
      .eq("id", disputeId);

    if (disputeUpdateError) {
      logger.error("Error updating dispute:", disputeUpdateError);
      throw disputeUpdateError;
    }

    // Update transaction status (using admin client)
    const transactionUpdate: any = {
      status: newTransactionStatus,
      funds_released: action === 'release',
      updated_at: new Date().toISOString()
    };

    // Add refund status for full refund
    if (action === 'refund') {
      transactionUpdate.refund_status = 'full';
    }

    const { error: transactionUpdateError } = await adminClient
      .from("transactions")
      .update(transactionUpdate)
      .eq("id", transaction.id);

    if (transactionUpdateError) {
      logger.error("Error updating transaction:", transactionUpdateError);
      throw transactionUpdateError;
    }

    // Mock admin notifications
    logger.log(`📧 ADMIN EMAIL: Dispute ${disputeId} resolved with action: ${action}`);
    logger.log(`📧 EMAIL: Dispute resolution completed for transaction ${transaction.title}`);
    logger.log(`📱 SMS: Your dispute has been resolved. Action taken: ${action}`);

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
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
