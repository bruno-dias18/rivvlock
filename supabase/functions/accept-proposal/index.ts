import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { z } from "https://deno.sh/x/zod@v3.22.4/mod.ts";
import { 
  compose, 
  withCors, 
  withAuth, 
  withRateLimit, 
  withValidation,
  successResponse,
  errorResponse 
} from "../_shared/middleware.ts";
import { logger } from "../_shared/logger.ts";

const acceptProposalSchema = z.object({
  proposalId: z.string().uuid(),
});

const handler = async (ctx: any) => {
  const { user, adminClient, body } = ctx;
  const { proposalId } = body;

  logger.log("Accepting proposal:", proposalId, "by user:", user.id);

  // Get the proposal with admin client to bypass RLS
  const { data: proposal, error: proposalError } = await adminClient
    .from("dispute_proposals")
    .select("*")
    .eq("id", proposalId)
    .single();

  if (proposalError || !proposal) {
    logger.error("Error fetching proposal:", proposalError);
    return errorResponse("Proposal not found", 404);
  }

  // Verify user is authorized (must not be the proposer)
  if (user.id === proposal.proposer_id) {
    return errorResponse("Cannot accept your own proposal", 400);
  }

  // Get the dispute with admin client to bypass RLS
  const { data: dispute, error: disputeError } = await adminClient
    .from("disputes")
    .select("*")
    .eq("id", proposal.dispute_id)
    .single();

  if (disputeError || !dispute) {
    logger.error("Error fetching dispute:", disputeError);
    return errorResponse("Dispute not found", 404);
  }

  // Get the transaction with admin client to bypass RLS
  const { data: transaction, error: transactionError } = await adminClient
    .from("transactions")
    .select("*")
    .eq("id", dispute.transaction_id)
    .single();

  if (transactionError || !transaction) {
    logger.error("Error fetching transaction:", transactionError);
    return errorResponse("Transaction not found", 404);
  }

  // Verify user is involved in the dispute
  const isInvolved = 
    user.id === dispute.reporter_id ||
    user.id === transaction.user_id ||
    user.id === transaction.buyer_id;

  if (!isInvolved) {
    return errorResponse("User not authorized to accept this proposal", 403);
  }

  if (proposal.status !== 'pending') {
    return errorResponse("Proposal is no longer pending", 400);
  }

  if (!['open', 'responded', 'negotiating'].includes(dispute.status)) {
    return errorResponse("Dispute is no longer open", 400);
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
      return errorResponse("No payment intent found for this transaction", 400);
    }

    const totalAmount = Math.round(transaction.price * 100);
    const refundPercentage = proposal.refund_percentage || 100;
    const isFullRefund = proposal.proposal_type === 'full_refund' || refundPercentage === 100;

    logger.log(`Processing ${refundPercentage}% refund for transaction ${transaction.id}`);

    // First, retrieve the PaymentIntent to check its status
    const paymentIntent = await stripe.paymentIntents.retrieve(transaction.stripe_payment_intent_id);
    logger.log(`PaymentIntent status: ${paymentIntent.status}`);

    if (paymentIntent.status === 'requires_capture') {
      // Authorization only (not captured yet)
      logger.log(`PaymentIntent not captured - handling authorization`);

      if (isFullRefund) {
        // Full refund = cancel the authorization completely, no Rivvlock fees
        await stripe.paymentIntents.cancel(transaction.stripe_payment_intent_id);
        logger.log(`✅ Authorization cancelled (full refund, no Rivvlock fees)`);
      } else {
        // Partial refund: capture full amount, then transfer seller share
        const platformFee = Math.round(totalAmount * 0.05);
        const capturePercentage = 100 - refundPercentage;
        const sellerShare = capturePercentage / 100;
        const currency = String(transaction.currency).toLowerCase();

        // Seller receives their share minus their portion of fees
        const sellerAmount = Math.round((totalAmount * sellerShare) - (platformFee * sellerShare));
        
        logger.log(`Partial refund: capturing full ${totalAmount / 100} ${currency}, then transferring ${sellerAmount / 100} to seller`);

        // Capture the full authorized amount
        await stripe.paymentIntents.capture(transaction.stripe_payment_intent_id);
        logger.log(`✅ Full amount captured: ${totalAmount / 100} ${currency}`);

        // Get seller's Stripe account
        const { data: sellerAccount, error: sellerAccountError } = await adminClient
          .from('stripe_accounts')
          .select('stripe_account_id, created_at')
          .eq('user_id', transaction.user_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (sellerAccountError) throw sellerAccountError;
        if (!sellerAccount?.stripe_account_id) {
          throw new Error('Seller Stripe account not found');
        }

        // Get the charge for source_transaction
        const refreshedPI = await stripe.paymentIntents.retrieve(transaction.stripe_payment_intent_id);
        const chargeId = typeof refreshedPI.latest_charge === 'string' ? refreshedPI.latest_charge : null;

        // Transfer seller's share
        await stripe.transfers.create({
          amount: sellerAmount,
          currency,
          destination: sellerAccount.stripe_account_id,
          transfer_group: `txn_${transaction.id}`,
          ...(chargeId ? { source_transaction: chargeId } : {}),
          metadata: {
            transaction_id: transaction.id,
            type: 'partial_refund_seller_share'
          }
        });
        logger.log(`✅ Transferred ${sellerAmount / 100} ${currency} to seller`);

        // Calculate and refund buyer's share
        const buyerRefund = Math.round((totalAmount * (refundPercentage / 100)) - (platformFee * (refundPercentage / 100)));
        
        await stripe.refunds.create({
          payment_intent: transaction.stripe_payment_intent_id,
          amount: buyerRefund,
          reason: 'requested_by_customer',
          metadata: {
            transaction_id: transaction.id,
            refund_percentage: String(refundPercentage)
          }
        });
        logger.log(`✅ Refunded ${buyerRefund / 100} ${currency} to buyer`);
        logger.log(`✅ Partial refund complete: Buyer ${buyerRefund / 100}, Seller ${sellerAmount / 100}, Rivvlock ${platformFee / 100} ${currency}`);
      }
    } else {
      // PaymentIntent already captured - transfer seller share first, then refund buyer
      logger.log(`PaymentIntent already captured - transferring seller share then refunding buyer`);

      const platformFee = Math.round(totalAmount * 0.05);
      const currency = String(transaction.currency).toLowerCase();

      // Determine amounts
      let refundAmount: number;
      let sellerAmount = 0;

      if (isFullRefund) {
        // Full refund: return everything to buyer, no seller transfer
        refundAmount = totalAmount;
        logger.log(`Full refund: ${refundAmount / 100} (no Rivvlock fees, no seller transfer)`);
      } else {
        // Partial refund: buyer and seller split amount and fees proportionally
        const buyerShare = refundPercentage / 100;
        const sellerShare = (100 - refundPercentage) / 100;
        refundAmount = Math.round((totalAmount * buyerShare) - (platformFee * buyerShare));
        sellerAmount = Math.round((totalAmount * sellerShare) - (platformFee * sellerShare));
        logger.log(`Partial refund distribution -> refund: ${refundAmount / 100}, seller: ${sellerAmount / 100}, fee: ${platformFee / 100}`);
      }

      // Get latest charge to link transfer to the original charge
      const refreshedPI = await stripe.paymentIntents.retrieve(transaction.stripe_payment_intent_id);
      const chargeId = typeof refreshedPI.latest_charge === 'string' ? refreshedPI.latest_charge : null;

      // Transfer seller's share first (if partial refund)
      if (sellerAmount > 0) {
        const { data: sellerAccount, error: sellerAccountError } = await adminClient
          .from('stripe_accounts')
          .select('stripe_account_id, created_at')
          .eq('user_id', transaction.user_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (sellerAccountError) throw sellerAccountError;
        if (!sellerAccount?.stripe_account_id) {
          throw new Error('Seller Stripe account not found');
        }

        await stripe.transfers.create({
          amount: sellerAmount,
          currency,
          destination: sellerAccount.stripe_account_id,
          transfer_group: `txn_${transaction.id}`,
          ...(chargeId ? { source_transaction: chargeId } : {}),
          metadata: {
            dispute_id: dispute.id,
            proposal_id: proposalId,
            type: 'partial_refund_seller_share'
          }
        });
        logger.log(`✅ Transferred ${sellerAmount / 100} ${currency} to seller (partial refund)`);
      }

      // Idempotency: avoid double refunds if already refunded previously
      if (refundAmount > 0) {
        const existingRefunds = await stripe.refunds.list({
          payment_intent: transaction.stripe_payment_intent_id,
          limit: 100,
        });
        const alreadyRefunded = existingRefunds.data
          .filter((r) => r.status !== 'failed')
          .reduce((sum, r) => sum + (r.amount || 0), 0);

        if (alreadyRefunded >= refundAmount) {
          logger.log(`⏭️ Refund already processed (amount_refunded=${alreadyRefunded}). Skipping.`);
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
          logger.log(`✅ Refunded ${amountToRefund / 100} ${currency} to buyer`);
        }
      }

      logger.log(`✅ Transfer and refund completed: ${refundPercentage}%`);
    }

    // Transaction is now validated with refund processed
    disputeStatus = 'resolved_refund';
    newTransactionStatus = 'validated';

  } else if (proposal.proposal_type === 'no_refund') {
    if (!transaction.stripe_payment_intent_id) {
      return errorResponse("No payment intent found for this transaction", 400);
    }

    // Release funds to seller - capture the payment on platform (if needed), then transfer net to seller
    const totalAmount = Math.round(transaction.price * 100);
    const platformFee = Math.round(totalAmount * 0.05);
    const currency = String(transaction.currency).toLowerCase();

    // Ensure seller has a connected Stripe account before proceeding
    const { data: sellerAccount, error: sellerAccountError } = await adminClient
      .from('stripe_accounts')
      .select('stripe_account_id')
      .eq('user_id', transaction.user_id)
      .maybeSingle();
    if (sellerAccountError) throw sellerAccountError;
    if (!sellerAccount?.stripe_account_id) {
      throw new Error('Seller Stripe account not found');
    }

    // Check PI status to avoid capture errors if already captured
    const pi = await stripe.paymentIntents.retrieve(transaction.stripe_payment_intent_id);
    logger.log(`NO_REFUND flow - PaymentIntent status: ${pi.status}`);
    let chargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : null;

    if (pi.status === 'requires_capture') {
      logger.log(`Capturing full amount for seller (no refund)`);
      const captured = await stripe.paymentIntents.capture(transaction.stripe_payment_intent_id);
      // refresh charge id after capture
      chargeId = typeof captured.latest_charge === 'string' ? captured.latest_charge : chargeId;
      logger.log(`✅ Full amount captured for no_refund`);
    } else if (pi.status === 'succeeded' || pi.status === 'processing') {
      logger.log(`Payment already captured or processing - skipping capture for no_refund`);
    } else if (pi.status === 'canceled') {
      throw new Error('Payment was canceled - cannot release funds');
    } else {
      // Any other state is unexpected for releasing funds
      throw new Error(`PaymentIntent not capturable (status=${pi.status})`);
    }

    // Transfer net amount to seller
    const transferAmount = totalAmount - platformFee;
    if (transferAmount > 0) {
      await stripe.transfers.create({
        amount: transferAmount,
        currency,
        destination: sellerAccount.stripe_account_id,
        transfer_group: `txn_${transaction.id}`,
        ...(chargeId ? { source_transaction: chargeId } : {}),
      });
      logger.log(`✅ Transferred ${transferAmount / 100} ${currency} to seller (net after fees)`);
    }

    disputeStatus = 'resolved_release';
    newTransactionStatus = 'validated';
    logger.log(`✅ Funds released to seller (no refund)`);
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
    logger.error("Error updating proposal status:", proposalUpdateError);
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
    logger.error("Error updating dispute:", disputeUpdateError);
  }

  // Update transaction status (keep original price, use refund_status instead)
  // Déterminer le refund_status
  let refundStatus: 'none' | 'partial' | 'full' = 'none';
  if (proposal.proposal_type === 'full_refund' || proposal.refund_percentage === 100) {
    refundStatus = 'full';
  } else if (proposal.proposal_type === 'partial_refund') {
    refundStatus = 'partial';
  }

  const { error: txUpdateError } = await adminClient
    .from("transactions")
    .update({ 
      status: newTransactionStatus,
      funds_released: proposal.proposal_type === 'no_refund',
      refund_status: refundStatus,
      updated_at: new Date().toISOString()
    })
    .eq("id", transaction.id);
  if (txUpdateError) {
    logger.error("Error updating transaction:", txUpdateError);
  }

  // Create confirmation message in conversation
  const confirmationText = proposal.proposal_type === 'partial_refund'
    ? `✅ Accord accepté : Remboursement de ${proposal.refund_percentage}% effectué automatiquement`
    : proposal.proposal_type === 'full_refund'
    ? `✅ Accord accepté : Remboursement intégral effectué automatiquement`
    : `✅ Accord accepté : Fonds libérés au vendeur`;

  // Write to unified conversations/messages if a conversation exists
  if (dispute.conversation_id) {
    await adminClient
      .from('messages')
      .insert({
        conversation_id: dispute.conversation_id,
        sender_id: user.id,
        message: confirmationText,
        message_type: 'system',
        metadata: {
          proposal_id: proposalId,
          proposal_type: proposal.proposal_type,
          refund_percentage: proposal.refund_percentage,
          dispute_id: dispute.id,
          transaction_id: transaction.id,
          accepted: true,
        },
      });
  }

  logger.log("✅ Proposal accepted and processed successfully");

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

  return successResponse({
    dispute_status: disputeStatus,
    transaction_status: newTransactionStatus
  });
};

const composedHandler = compose(
  withCors,
  withAuth,
  withRateLimit({ maxRequests: 10, windowMs: 60000 }),
  withValidation(acceptProposalSchema)
)(handler);

serve(composedHandler);
