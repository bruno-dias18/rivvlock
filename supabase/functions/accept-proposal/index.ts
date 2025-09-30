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

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    }
  );

  try {
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const user = userData.user;
    
    if (!user?.id) {
      throw new Error("User not authenticated");
    }

    const { proposalId } = await req.json();

    console.log("Accepting proposal:", proposalId, "by user:", user.id);

    // Get the proposal
    const { data: proposal, error: proposalError } = await supabaseClient
      .from("dispute_proposals")
      .select("*")
      .eq("id", proposalId)
      .single();

    if (proposalError || !proposal) {
      console.error("Error fetching proposal:", proposalError);
      throw new Error("Proposal not found");
    }

    // Verify user is authorized (must not be the proposer)
    if (user.id === proposal.proposer_id) {
      throw new Error("Cannot accept your own proposal");
    }

    // Get the dispute
    const { data: dispute, error: disputeError } = await supabaseClient
      .from("disputes")
      .select("*")
      .eq("id", proposal.dispute_id)
      .single();

    if (disputeError || !dispute) {
      console.error("Error fetching dispute:", disputeError);
      throw new Error("Dispute not found");
    }

    // Get the transaction
    const { data: transaction, error: transactionError } = await supabaseClient
      .from("transactions")
      .select("*")
      .eq("id", dispute.transaction_id)
      .single();

    if (transactionError || !transaction) {
      console.error("Error fetching transaction:", transactionError);
      throw new Error("Transaction not found");
    }

    // Verify user is involved in the dispute
    const isInvolved = 
      user.id === dispute.reporter_id ||
      user.id === transaction.user_id ||
      user.id === transaction.buyer_id;

    if (!isInvolved) {
      throw new Error("User not authorized to accept this proposal");
    }

    if (proposal.status !== 'pending') {
      throw new Error("Proposal is no longer pending");
    }

    if (!['open', 'responded', 'negotiating'].includes(dispute.status)) {
      throw new Error("Dispute is no longer open");
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-06-20",
    });

    let newTransactionStatus = transaction.status;
    let disputeStatus = 'resolved_agreement';

    // Process the refund based on proposal type
    if (proposal.proposal_type === 'partial_refund' || proposal.proposal_type === 'full_refund') {
      if (!transaction.stripe_payment_intent_id) {
        throw new Error("No payment intent found for this transaction");
      }

      const totalAmount = Math.round(transaction.price * 100);
      const refundPercentage = proposal.refund_percentage || 100;

      console.log(`Processing ${refundPercentage}% refund for transaction ${transaction.id}`);

      // First, retrieve the PaymentIntent to check its status
      const paymentIntent = await stripe.paymentIntents.retrieve(transaction.stripe_payment_intent_id);
      console.log(`PaymentIntent status: ${paymentIntent.status}`);

      if (paymentIntent.status === 'requires_capture') {
        // PaymentIntent is not captured yet - we need to cancel or capture partially
        console.log(`PaymentIntent not captured - handling authorization`);

        if (proposal.proposal_type === 'full_refund') {
          // Full refund = cancel the authorization completely
          await stripe.paymentIntents.cancel(transaction.stripe_payment_intent_id);
          console.log(`✅ Authorization cancelled (full refund)`);
        } else {
          // Partial refund = capture only the remaining amount (100% - refund%)
          const capturePercentage = 100 - refundPercentage;
          const captureAmount = Math.round((totalAmount * capturePercentage) / 100);
          const platformFee = Math.round(totalAmount * 0.05);

          console.log(`Capturing ${capturePercentage}% (${captureAmount / 100} ${transaction.currency})`);

          await stripe.paymentIntents.capture(transaction.stripe_payment_intent_id, {
            amount_to_capture: captureAmount,
            application_fee_amount: platformFee,
          });

          console.log(`✅ Partial capture processed: ${capturePercentage}% to seller, ${refundPercentage}% refunded to buyer`);
        }

      } else if (paymentIntent.status === 'succeeded') {
        // PaymentIntent already captured - create a refund
        console.log(`PaymentIntent already captured - creating refund`);

        const refundAmount = Math.round((totalAmount * refundPercentage) / 100);

        await stripe.refunds.create({
          payment_intent: transaction.stripe_payment_intent_id,
          amount: refundAmount,
          reason: 'requested_by_customer',
          metadata: {
            dispute_id: dispute.id,
            proposal_id: proposalId,
            refund_percentage: String(refundPercentage)
          }
        });

        console.log(`✅ Refund processed: ${refundPercentage}%`);
      } else {
        throw new Error(`Cannot process refund - PaymentIntent has status: ${paymentIntent.status}`);
      }

      newTransactionStatus = 'disputed';

    } else if (proposal.proposal_type === 'no_refund') {
      if (!transaction.stripe_payment_intent_id) {
        throw new Error("No payment intent found for this transaction");
      }

      // Release funds to seller - capture the payment
      const totalAmount = Math.round(transaction.price * 100);
      const platformFee = Math.round(totalAmount * 0.05);

      console.log(`Capturing full amount for seller (no refund)`);

      await stripe.paymentIntents.capture(
        transaction.stripe_payment_intent_id,
        {
          application_fee_amount: platformFee,
        }
      );

      newTransactionStatus = 'completed';
      console.log(`✅ Funds released to seller (no refund)`);
    }

    // Update proposal status
    await supabaseClient
      .from("dispute_proposals")
      .update({ 
        status: 'accepted',
        updated_at: new Date().toISOString()
      })
      .eq("id", proposalId);

    // Update dispute status
    await supabaseClient
      .from("disputes")
      .update({ 
        status: disputeStatus,
        resolved_at: new Date().toISOString(),
        resolution: `Agreement reached: ${proposal.proposal_type} - ${proposal.refund_percentage || 0}% refund`,
        updated_at: new Date().toISOString()
      })
      .eq("id", dispute.id);

    // Update transaction status
    await supabaseClient
      .from("transactions")
      .update({ 
        status: newTransactionStatus,
        funds_released: proposal.proposal_type === 'no_refund',
        updated_at: new Date().toISOString()
      })
      .eq("id", transaction.id);

    // Create confirmation message
    const confirmationText = proposal.proposal_type === 'partial_refund'
      ? `✅ Accord accepté : Remboursement de ${proposal.refund_percentage}% effectué automatiquement`
      : proposal.proposal_type === 'full_refund'
      ? `✅ Accord accepté : Remboursement intégral effectué automatiquement`
      : `✅ Accord accepté : Fonds libérés au vendeur`;

    await supabaseClient
      .from("dispute_messages")
      .insert({
        dispute_id: dispute.id,
        sender_id: user.id,
        message: confirmationText,
        message_type: 'system',
      });

    console.log("✅ Proposal accepted and processed successfully");

    return new Response(JSON.stringify({ 
      success: true,
      dispute_status: disputeStatus,
      transaction_status: newTransactionStatus
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error in accept-proposal:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
