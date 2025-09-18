import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
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
    const { disputeId, action, adminNotes } = await req.json(); // action: 'refund' or 'release'
    
    console.log("Processing dispute:", disputeId, "Action:", action);

    // Get dispute and related transaction
    const { data: dispute, error: disputeError } = await supabaseClient
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
      apiVersion: "2025-08-27.basil",
    });

    let result;
    let newTransactionStatus;
    let disputeStatus;

    if (action === 'refund') {
      // Refund the buyer (platform keeps 5% fee)
      const totalAmount = Math.round(transaction.price * 100);
      const platformFee = Math.round(totalAmount * 0.05);
      const refundAmount = totalAmount - platformFee;

      result = await stripe.refunds.create({
        payment_intent: transaction.stripe_payment_intent_id,
        amount: refundAmount, // Refund minus platform fee
        reason: 'requested_by_customer',
        metadata: {
          dispute_id: disputeId,
          admin_action: 'refund_approved'
        }
      });

      newTransactionStatus = 'disputed';
      disputeStatus = 'resolved_refund';

      console.log(`💰 REFUND: ${(refundAmount / 100).toFixed(2)} ${transaction.currency} refunded to buyer`);
      console.log(`💰 FEE RETAINED: ${(platformFee / 100).toFixed(2)} ${transaction.currency} platform fee`);

    } else if (action === 'release') {
      // Release funds to seller minus platform fee
      const totalAmount = Math.round(transaction.price * 100);
      const platformFee = Math.round(totalAmount * 0.05);

      result = await stripe.paymentIntents.capture(
        transaction.stripe_payment_intent_id,
        {
          application_fee_amount: platformFee,
        }
      );

      newTransactionStatus = 'completed';
      disputeStatus = 'resolved_release';

      console.log(`💰 RELEASE: ${((totalAmount - platformFee) / 100).toFixed(2)} ${transaction.currency} released to seller`);
    } else {
      throw new Error("Invalid action. Must be 'refund' or 'release'");
    }

    // Update dispute status
    const { error: disputeUpdateError } = await supabaseClient
      .from("disputes")
      .update({ 
        status: disputeStatus,
        admin_notes: adminNotes,
        updated_at: new Date().toISOString()
      })
      .eq("id", disputeId);

    if (disputeUpdateError) {
      console.error("Error updating dispute:", disputeUpdateError);
    }

    // Update transaction status
    const { error: transactionUpdateError } = await supabaseClient
      .from("transactions")
      .update({ 
        status: newTransactionStatus,
        funds_released: action === 'release',
        updated_at: new Date().toISOString()
      })
      .eq("id", transaction.id);

    if (transactionUpdateError) {
      console.error("Error updating transaction:", transactionUpdateError);
    }

    // Mock admin notifications
    console.log(`📧 ADMIN EMAIL: Dispute ${disputeId} resolved with action: ${action}`);
    console.log(`📧 EMAIL: Dispute resolution completed for transaction ${transaction.title}`);
    console.log(`📱 SMS: Your dispute has been resolved. Action taken: ${action}`);

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
    console.error("Error processing dispute:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
