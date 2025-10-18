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

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    }
  );

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

    const { proposalId, action } = await req.json(); // action: 'accept' or 'reject'

    logger.log("[VALIDATE-ADMIN-PROPOSAL] User", user.id, action, "proposal", proposalId);

    // Get the proposal
    const { data: proposal, error: proposalError } = await supabaseClient
      .from("dispute_proposals")
      .select("*")
      .eq("id", proposalId)
      .single();

    if (proposalError || !proposal) {
      logger.error("Error fetching proposal:", proposalError);
      throw new Error("Proposal not found");
    }

    // Verify this is an admin-created proposal
    if (!proposal.admin_created || !proposal.requires_both_parties) {
      throw new Error("This is not an admin official proposal");
    }

    // Get dispute details separately
    const { data: dispute, error: disputeError } = await supabaseClient
      .from("disputes")
      .select("id, status, transaction_id")
      .eq("id", proposal.dispute_id)
      .single();

    if (disputeError || !dispute) {
      logger.error("Error fetching dispute:", disputeError);
      throw new Error("Dispute not found");
    }

    // Get transaction details separately
    const { data: transaction, error: transactionError } = await supabaseClient
      .from("transactions")
      .select("id, user_id, buyer_id, stripe_payment_intent_id, price, currency, status")
      .eq("id", dispute.transaction_id)
      .single();

    if (transactionError || !transaction) {
      logger.error("Error fetching transaction:", transactionError);
      throw new Error("Transaction not found");
    }

    // Determine user role
    const isSeller = user.id === transaction.user_id;
    const isBuyer = user.id === transaction.buyer_id;

    if (!isSeller && !isBuyer) {
      throw new Error("User not authorized to validate this proposal");
    }

    if (proposal.status !== 'pending') {
      throw new Error("Proposal is no longer pending");
    }

    // Handle rejection
    if (action === 'reject') {
      await adminClient
        .from("dispute_proposals")
        .update({ 
          status: 'rejected',
          rejected_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq("id", proposalId);

      // Update dispute status back to escalated
      await adminClient
        .from("disputes")
        .update({ 
          status: 'escalated',
          updated_at: new Date().toISOString()
        })
        .eq("id", dispute.id);

      // Send rejection message to admin conversation
      const rejectMessage = `❌ ${isSeller ? 'Le vendeur' : 'L\'acheteur'} a rejeté la proposition officielle de l'administration.`;
      try {
        // Find the admin conversation for this party
        const { data: conversation } = await adminClient
          .from("conversations")
          .select("id")
          .eq("dispute_id", dispute.id)
          .eq("conversation_type", isSeller ? 'admin_seller_dispute' : 'admin_buyer_dispute')
          .single();

        if (conversation) {
          await adminClient
            .from("messages")
            .insert({
              conversation_id: conversation.id,
              sender_id: user.id,
              message: rejectMessage,
              message_type: isSeller ? 'seller_to_admin' : 'buyer_to_admin',
            });
        }
      } catch (msgError) {
        logger.warn("Non-critical: Could not insert rejection message", msgError);
      }

      logger.log("[VALIDATE-ADMIN-PROPOSAL] Proposal rejected by", isSeller ? 'seller' : 'buyer');

      return new Response(JSON.stringify({ 
        success: true,
        status: 'rejected'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Handle acceptance
    const updates: any = { updated_at: new Date().toISOString() };
    
    if (isSeller) {
      updates.seller_validated = true;
    } else if (isBuyer) {
      updates.buyer_validated = true;
    }

    await adminClient
      .from("dispute_proposals")
      .update(updates)
      .eq("id", proposalId);

    // Send validation message to admin conversation
    const validationMessage = `✅ ${isSeller ? 'Le vendeur' : 'L\'acheteur'} a validé la proposition officielle.`;
    try {
      // Find the admin conversation for this party
      const { data: conversation } = await adminClient
        .from("conversations")
        .select("id")
        .eq("dispute_id", dispute.id)
        .eq("conversation_type", isSeller ? 'admin_seller_dispute' : 'admin_buyer_dispute')
        .single();

      if (conversation) {
        await adminClient
          .from("messages")
          .insert({
            conversation_id: conversation.id,
            sender_id: user.id,
            message: validationMessage,
            message_type: isSeller ? 'seller_to_admin' : 'buyer_to_admin',
          });
      }
    } catch (msgError) {
      logger.warn("Non-critical: Could not insert validation message", msgError);
    }

    // Re-fetch proposal to get the updated validation status
    const { data: updatedProposal, error: refetchError } = await adminClient
      .from("dispute_proposals")
      .select("*")
      .eq("id", proposalId)
      .single();

    if (refetchError || !updatedProposal) {
      logger.error("Error refetching proposal after update:", refetchError);
      throw new Error("Could not verify proposal status");
    }

    // Check if both parties have validated (using fresh data from DB)
    if (updatedProposal.buyer_validated && updatedProposal.seller_validated) {
      logger.log("[VALIDATE-ADMIN-PROPOSAL] Both parties validated - processing Stripe transaction");

      // Both parties validated - process on Stripe
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2024-06-20",
      });

      let disputeStatus: 'resolved' | 'resolved_refund' | 'resolved_release' = 'resolved';
      let newTransactionStatus = transaction.status;

      // Process based on proposal type
      if (proposal.proposal_type === 'partial_refund' || proposal.proposal_type === 'full_refund') {
        if (!transaction.stripe_payment_intent_id) {
          throw new Error("No payment intent found for this transaction");
        }

        const totalAmount = Math.round(transaction.price * 100);
        const refundPercentage = proposal.refund_percentage || 100;
        const isFullRefund = proposal.proposal_type === 'full_refund' || refundPercentage === 100;

        logger.log(`Processing ${refundPercentage}% refund`);

        const paymentIntent = await stripe.paymentIntents.retrieve(transaction.stripe_payment_intent_id);

        if (paymentIntent.status === 'requires_capture') {
          if (isFullRefund) {
            await stripe.paymentIntents.cancel(transaction.stripe_payment_intent_id);
            logger.log("✅ Full refund - authorization cancelled");
          } else {
            // Partial refund logic (same as accept-proposal)
            const capturePercentage = 100 - refundPercentage;
            const platformFee = Math.round(totalAmount * 0.05);
            const sellerShare = capturePercentage / 100;
            const sellerAmount = Math.round((totalAmount * sellerShare) - (platformFee * sellerShare));
            const captureAmount = sellerAmount + platformFee;
            const currency = String(transaction.currency).toLowerCase();

            const { data: sellerAccount, error: accountError } = await adminClient
              .from('stripe_accounts')
              .select('stripe_account_id, charges_enabled, payouts_enabled')
              .eq('user_id', transaction.user_id)
              .maybeSingle();

            if (accountError) {
              throw new Error(`Failed to fetch seller Stripe account: ${accountError.message}`);
            }

            if (!sellerAccount?.stripe_account_id) {
              throw new Error('Seller Stripe account not found - cannot process payment');
            }

            if (!sellerAccount.charges_enabled || !sellerAccount.payouts_enabled) {
              throw new Error('Seller Stripe account not fully activated - cannot transfer funds');
            }

            logger.log(`Capturing ${captureAmount / 100} ${currency} from payment intent`);
            await stripe.paymentIntents.capture(transaction.stripe_payment_intent_id, {
              amount_to_capture: captureAmount,
            });

            if (sellerAmount > 0) {
              logger.log(`Transferring ${sellerAmount / 100} ${currency} to seller account ${sellerAccount.stripe_account_id}`);
              await stripe.transfers.create({
                amount: sellerAmount,
                currency,
                destination: sellerAccount.stripe_account_id,
                transfer_group: `txn_${transaction.id}`,
              });
              logger.log(`✅ Transfer completed successfully`);
            }

            logger.log(`✅ Partial refund processed: ${refundPercentage}%`);
          }
        } else if (paymentIntent.status === 'succeeded') {
          // Already captured - create refund AND transfer to seller
          const platformFee = Math.round(totalAmount * 0.05);
          const currency = String(transaction.currency).toLowerCase();
          let refundAmount: number;
          let sellerAmount = 0;

          if (isFullRefund) {
            refundAmount = totalAmount;
          } else {
            const buyerShare = refundPercentage / 100;
            const sellerShare = (100 - refundPercentage) / 100;
            refundAmount = Math.round((totalAmount * buyerShare) - (platformFee * buyerShare));
            sellerAmount = Math.round((totalAmount * sellerShare) - (platformFee * sellerShare));
          }

          await stripe.refunds.create({
            payment_intent: transaction.stripe_payment_intent_id,
            amount: refundAmount,
            reason: 'requested_by_customer',
            metadata: {
              dispute_id: dispute.id,
              proposal_id: proposalId,
              admin_official: 'true'
            }
          });

          // Transfer seller's share (if partial refund)
          if (sellerAmount > 0) {
            const { data: sellerAccount, error: accountError } = await adminClient
              .from('stripe_accounts')
              .select('stripe_account_id, charges_enabled, payouts_enabled')
              .eq('user_id', transaction.user_id)
              .maybeSingle();

            if (accountError) {
              throw new Error(`Failed to fetch seller Stripe account: ${accountError.message}`);
            }

            if (!sellerAccount?.stripe_account_id) {
              throw new Error('Seller Stripe account not found - cannot transfer funds');
            }

            if (!sellerAccount.charges_enabled || !sellerAccount.payouts_enabled) {
              throw new Error('Seller Stripe account not fully activated - cannot transfer funds');
            }

            logger.log(`Transferring ${sellerAmount / 100} ${currency} to seller account ${sellerAccount.stripe_account_id}`);
            await stripe.transfers.create({
              amount: sellerAmount,
              currency,
              destination: sellerAccount.stripe_account_id,
              transfer_group: `txn_${transaction.id}`,
              metadata: {
                dispute_id: dispute.id,
                proposal_id: proposalId,
                type: 'admin_partial_refund_seller_share'
              }
            });
            logger.log(`✅ Transfer completed successfully: ${sellerAmount / 100} ${currency}`);
          }

          logger.log(`✅ Refund and transfer completed: ${refundPercentage}%`);
        }

        disputeStatus = 'resolved_refund';
        newTransactionStatus = 'validated';

      } else if (proposal.proposal_type === 'no_refund') {
        // Release funds to seller
        const totalAmount = Math.round(transaction.price * 100);
        const platformFee = Math.round(totalAmount * 0.05);
        const currency = String(transaction.currency).toLowerCase();

        const { data: sellerAccount, error: accountError } = await adminClient
          .from('stripe_accounts')
          .select('stripe_account_id, charges_enabled, payouts_enabled')
          .eq('user_id', transaction.user_id)
          .maybeSingle();

        if (accountError) {
          throw new Error(`Failed to fetch seller Stripe account: ${accountError.message}`);
        }

        if (!sellerAccount?.stripe_account_id) {
          throw new Error('Seller Stripe account not found - cannot release funds');
        }

        if (!sellerAccount.charges_enabled || !sellerAccount.payouts_enabled) {
          throw new Error('Seller Stripe account not fully activated - cannot release funds');
        }

        logger.log(`Capturing full amount ${totalAmount / 100} ${currency} from payment intent`);
        await stripe.paymentIntents.capture(transaction.stripe_payment_intent_id);

        const transferAmount = totalAmount - platformFee;
        if (transferAmount > 0) {
          logger.log(`Transferring ${transferAmount / 100} ${currency} to seller account ${sellerAccount.stripe_account_id}`);
          await stripe.transfers.create({
            amount: transferAmount,
            currency,
            destination: sellerAccount.stripe_account_id,
            transfer_group: `txn_${transaction.id}`,
          });
          logger.log(`✅ Transfer completed successfully`);
        }

        disputeStatus = 'resolved_release';
        newTransactionStatus = 'validated';
        logger.log("✅ Funds released to seller");
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
        logger.error("Failed to update proposal status:", proposalUpdateError);
        throw new Error(`Database error updating proposal: ${proposalUpdateError.message}`);
      }

      // Update dispute
      const { error: disputeUpdateError } = await adminClient
        .from("disputes")
        .update({ 
          status: disputeStatus,
          resolved_at: new Date().toISOString(),
          resolution: `Accord administratif accepté par les deux parties: ${proposal.proposal_type} - ${proposal.refund_percentage || 0}% refund`,
          updated_at: new Date().toISOString()
        })
        .eq("id", dispute.id);

      if (disputeUpdateError) {
        logger.error("Failed to update dispute status:", disputeUpdateError);
        throw new Error(`Database error updating dispute: ${disputeUpdateError.message}`);
      }

      // Update transaction (keep original price, use refund_status instead)
      const { error: transactionUpdateError } = await adminClient
        .from("transactions")
        .update({ 
          status: newTransactionStatus,
          funds_released: proposal.proposal_type === 'no_refund',
          refund_status: (proposal.proposal_type === 'full_refund' || proposal.refund_percentage === 100)
            ? 'full'
            : (proposal.proposal_type === 'partial_refund' ? 'partial' : 'none'),
          updated_at: new Date().toISOString()
        })
        .eq("id", transaction.id);

      if (transactionUpdateError) {
        logger.error("Failed to update transaction:", transactionUpdateError);
        throw new Error(`Database error updating transaction: ${transactionUpdateError.message}`);
      }

      logger.log("✅ All database updates completed successfully");

      // Send success message
      const confirmationText = proposal.proposal_type === 'partial_refund'
        ? `✅ Les deux parties ont validé la proposition : Remboursement de ${proposal.refund_percentage}% effectué automatiquement`
        : proposal.proposal_type === 'full_refund'
        ? `✅ Les deux parties ont validé la proposition : Remboursement intégral effectué automatiquement`
        : `✅ Les deux parties ont validé la proposition : Fonds libérés au vendeur`;

      try {
        // Get admin conversations
        const { data: sellerConv } = await adminClient
          .from("conversations")
          .select("id")
          .eq("dispute_id", dispute.id)
          .eq("conversation_type", 'admin_seller_dispute')
          .single();

        const { data: buyerConv } = await adminClient
          .from("conversations")
          .select("id")
          .eq("dispute_id", dispute.id)
          .eq("conversation_type", 'admin_buyer_dispute')
          .single();

        // Message au vendeur
        if (sellerConv) {
          await adminClient
            .from("messages")
            .insert({
              conversation_id: sellerConv.id,
              sender_id: user.id,
              message: confirmationText,
              message_type: 'admin_to_seller',
            });
        }
        
        // Message à l'acheteur
        if (buyerConv) {
          await adminClient
            .from("messages")
            .insert({
              conversation_id: buyerConv.id,
              sender_id: user.id,
              message: confirmationText,
              message_type: 'admin_to_buyer',
            });
        }
      } catch (msgError) {
        logger.warn("Non-critical: Could not insert confirmation messages", msgError);
      }

      logger.log("[VALIDATE-ADMIN-PROPOSAL] Proposal fully accepted and processed");

      return new Response(JSON.stringify({ 
        success: true,
        status: 'accepted',
        both_validated: true,
        dispute_status: disputeStatus
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logger.log("[VALIDATE-ADMIN-PROPOSAL] Validation recorded, waiting for other party");

    // Log activity for the other participant (they need to know someone validated)
    const otherParticipantId = user.id === transaction.user_id ? transaction.buyer_id : transaction.user_id;
    
    if (otherParticipantId) {
      await adminClient.from('activity_logs').insert({
        user_id: otherParticipantId,
        activity_type: 'dispute_proposal_accepted',
        title: `Validation de proposition pour "${transaction.title}"`,
        description: 'L\'autre partie a validé la proposition officielle de l\'administration. En attente de votre validation.',
        metadata: {
          dispute_id: dispute.id,
          transaction_id: transaction.id,
          proposal_id: proposalId
        }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      status: 'pending',
      both_validated: false,
      seller_validated: updatedProposal.seller_validated,
      buyer_validated: updatedProposal.buyer_validated
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    logger.error("[VALIDATE-ADMIN-PROPOSAL] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
