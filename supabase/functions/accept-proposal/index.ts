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

  // Admin client to bypass RLS for server-side writes after business checks
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
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
    let disputeStatus: 'resolved' | 'resolved_refund' | 'resolved_release' = 'resolved';

    // Process the refund based on proposal type
    if (proposal.proposal_type === 'partial_refund' || proposal.proposal_type === 'full_refund') {
      if (!transaction.stripe_payment_intent_id) {
        throw new Error("No payment intent found for this transaction");
      }

      const totalAmount = Math.round(transaction.price * 100);
      const refundPercentage = proposal.refund_percentage || 100;
      const isFullRefund = proposal.proposal_type === 'full_refund' || refundPercentage === 100;

      console.log(`Processing ${refundPercentage}% refund for transaction ${transaction.id}`);

      // First, retrieve the PaymentIntent to check its status
      const paymentIntent = await stripe.paymentIntents.retrieve(transaction.stripe_payment_intent_id);
      console.log(`PaymentIntent status: ${paymentIntent.status}`);

      if (paymentIntent.status === 'requires_capture') {
        // PaymentIntent is not captured yet - we need to cancel or capture partially
        console.log(`PaymentIntent not captured - handling authorization`);

        if (isFullRefund) {
          // Full refund = cancel the authorization completely, no Rivvlock fees
          await stripe.paymentIntents.cancel(transaction.stripe_payment_intent_id);
          console.log(`✅ Authorization cancelled (full refund, no Rivvlock fees)`);
        } else {
          // Partial refund: Rivvlock fees (5%) are shared proportionally
          const capturePercentage = 100 - refundPercentage;
          const platformFee = Math.round(totalAmount * 0.05);
          
          // Calculate amounts after sharing fees proportionally
          const sellerShare = capturePercentage / 100;
          const buyerShare = refundPercentage / 100;
          
          // Seller receives their share minus their portion of fees
          const sellerAmount = Math.round((totalAmount * sellerShare) - (platformFee * sellerShare));
          // Buyer refund = total - seller amount - platform fees
          const captureAmount = sellerAmount + platformFee;
          
          const currency = String(transaction.currency).toLowerCase();

          // Ensure seller has a connected Stripe account before capturing
          const { data: sellerAccount, error: sellerAccountError } = await supabaseClient
            .from('stripe_accounts')
            .select('stripe_account_id')
            .eq('user_id', transaction.user_id)
            .maybeSingle();
          if (sellerAccountError) throw sellerAccountError;
          if (!sellerAccount?.stripe_account_id) {
            throw new Error('Seller Stripe account not found');
          }

          console.log(`Capturing ${captureAmount / 100} ${currency} (seller: ${sellerAmount / 100}, fees: ${platformFee / 100})`);

          // Capture on platform account
          await stripe.paymentIntents.capture(transaction.stripe_payment_intent_id, {
            amount_to_capture: captureAmount,
          });

          // Transfer net amount to the seller's connected account (seller share minus their portion of fees)
          if (sellerAmount > 0) {
            await stripe.transfers.create({
              amount: sellerAmount,
              currency,
              destination: sellerAccount.stripe_account_id,
              transfer_group: `txn_${transaction.id}`,
            });
            console.log(`✅ Transferred ${sellerAmount / 100} ${currency} to seller (after proportional fees)`);
          }

          const buyerRefund = totalAmount - captureAmount;
          console.log(`✅ Partial refund: Buyer gets ${buyerRefund / 100} ${currency}, Seller gets ${sellerAmount / 100} ${currency}, Rivvlock ${platformFee / 100} ${currency}`);
        }

      } else if (paymentIntent.status === 'succeeded') {
        // PaymentIntent already captured - create a refund
        console.log(`PaymentIntent already captured - creating refund`);

        let refundAmount: number;
        if (isFullRefund) {
          // Full refund: return everything to buyer, no Rivvlock fees
          refundAmount = totalAmount;
          console.log(`Full refund: ${refundAmount / 100} (no Rivvlock fees)`);
        } else {
          // Partial refund: buyer gets their share minus their portion of fees
          const platformFee = Math.round(totalAmount * 0.05);
          const buyerShare = refundPercentage / 100;
          refundAmount = Math.round((totalAmount * buyerShare) - (platformFee * buyerShare));
          console.log(`Partial refund: ${refundAmount / 100} (buyer share after proportional fees)`);
        }

        // Idempotency: avoid double refunds if already refunded previously
        const existingRefunds = await stripe.refunds.list({
          payment_intent: transaction.stripe_payment_intent_id,
          limit: 100,
        });
        const alreadyRefunded = existingRefunds.data
          .filter((r) => r.status !== 'failed')
          .reduce((sum, r) => sum + (r.amount || 0), 0);

        if (alreadyRefunded >= refundAmount) {
          console.log(`⏭️ Refund already processed (amount_refunded=${alreadyRefunded}). Skipping.`);
        } else {
          const amountToRefund = refundAmount - alreadyRefunded;
          await stripe.refunds.create({
            payment_intent: transaction.stripe_payment_intent_id,
            amount: amountToRefund,
            reason: 'requested_by_customer',
            metadata: {
              dispute_id: dispute.id,
              proposal_id: proposalId,
              refund_percentage: String(refundPercentage)
            }
          });
        }

        console.log(`✅ Refund processed/check completed: ${refundPercentage}%`);
      } else {
        throw new Error(`Cannot process refund - PaymentIntent has status: ${paymentIntent.status}`);
      }

      // Transaction is now validated with refund processed
      disputeStatus = 'resolved_refund';
      newTransactionStatus = 'validated';

    } else if (proposal.proposal_type === 'no_refund') {
      if (!transaction.stripe_payment_intent_id) {
        throw new Error("No payment intent found for this transaction");
      }

      // Release funds to seller - capture the payment on platform, then transfer net to seller
      const totalAmount = Math.round(transaction.price * 100);
      const platformFee = Math.round(totalAmount * 0.05);
      const currency = String(transaction.currency).toLowerCase();

      // Ensure seller has a connected Stripe account before proceeding
      const { data: sellerAccount, error: sellerAccountError } = await supabaseClient
        .from('stripe_accounts')
        .select('stripe_account_id')
        .eq('user_id', transaction.user_id)
        .maybeSingle();
      if (sellerAccountError) throw sellerAccountError;
      if (!sellerAccount?.stripe_account_id) {
        throw new Error('Seller Stripe account not found');
      }

      console.log(`Capturing full amount for seller (no refund)`);

      // Capture without application_fee_amount (separate charges + transfers)
      await stripe.paymentIntents.capture(
        transaction.stripe_payment_intent_id
      );

      // Transfer net amount to seller
      const transferAmount = totalAmount - platformFee;
      if (transferAmount > 0) {
        await stripe.transfers.create({
          amount: transferAmount,
          currency,
          destination: sellerAccount.stripe_account_id,
          transfer_group: `txn_${transaction.id}`,
        });
        console.log(`✅ Transferred ${transferAmount / 100} ${currency} to seller (net after fees)`);
      }

      disputeStatus = 'resolved_release';
      newTransactionStatus = 'validated';
      console.log(`✅ Funds released to seller (no refund)`);
    }

    // Update proposal status
    const { error: proposalUpdateError } = await adminClient
      .from("dispute_proposals")
      .update({ 
        status: 'accepted',
        updated_at: new Date().toISOString()
      })
      .eq("id", proposalId);
    if (proposalUpdateError) {
      console.error("Error updating proposal status:", proposalUpdateError);
    }

    // Update dispute status
    const { error: disputeUpdateError } = await adminClient
      .from("disputes")
      .update({ 
        status: disputeStatus,
        resolved_at: new Date().toISOString(),
        resolution: `Agreement reached: ${proposal.proposal_type} - ${proposal.refund_percentage || 0}% refund`,
        updated_at: new Date().toISOString()
      })
      .eq("id", dispute.id);
    if (disputeUpdateError) {
      console.error("Error updating dispute:", disputeUpdateError);
    }

    // Calculate updated price for partial refund
    let updatedPrice = transaction.price;
    if (proposal.proposal_type === 'partial_refund') {
      const refundPercentage = proposal.refund_percentage || 0;
      const remainingPercentage = 100 - refundPercentage;
      updatedPrice = (transaction.price * remainingPercentage) / 100;
    }

    // Update transaction status and price
    const { error: txUpdateError } = await adminClient
      .from("transactions")
      .update({ 
        status: newTransactionStatus,
        price: updatedPrice,
        funds_released: proposal.proposal_type === 'no_refund',
        updated_at: new Date().toISOString()
      })
      .eq("id", transaction.id);
    if (txUpdateError) {
      console.error("Error updating transaction:", txUpdateError);
    }

    // Create confirmation message
    const confirmationText = proposal.proposal_type === 'partial_refund'
      ? `✅ Accord accepté : Remboursement de ${proposal.refund_percentage}% effectué automatiquement`
      : proposal.proposal_type === 'full_refund'
      ? `✅ Accord accepté : Remboursement intégral effectué automatiquement`
      : `✅ Accord accepté : Fonds libérés au vendeur`;

    const { error: messageInsertError } = await adminClient
      .from("dispute_messages")
      .insert({
        dispute_id: dispute.id,
        sender_id: user.id,
        message: confirmationText,
        message_type: 'system',
      });
    if (messageInsertError) {
      console.error("Error inserting system message:", messageInsertError);
    }

    console.log("✅ Proposal accepted and processed successfully");

    // Log activity for all other participants
    const participants = [transaction.user_id, transaction.buyer_id].filter(id => id && id !== user.id);
    
    for (const participantId of participants) {
      await adminClient.from('activity_logs').insert({
        user_id: participantId,
        activity_type: 'dispute_proposal_accepted',
        title: `Proposition acceptée pour "${transaction.title}"`,
        description: confirmationText,
        metadata: {
          dispute_id: dispute.id,
          transaction_id: transaction.id,
          proposal_id: proposalId,
          proposal_type: proposal.proposal_type
        }
      });
    }

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
