import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
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

const adminProposalSchema = z.object({
  disputeId: z.string().uuid(),
  proposalType: z.enum(['full_refund', 'partial_refund', 'no_refund']),
  refundPercentage: z.number().min(0).max(100).nullable().optional(),
  message: z.string().optional(),
  immediateExecution: z.boolean().optional(),
});

const handler = async (ctx: any) => {
  try {
    const { user, supabaseClient, adminClient, body } = ctx;
    const { disputeId, proposalType, refundPercentage, message, immediateExecution = false } = body;

    // Verify user is admin via secure RPC
    const { data: isAdmin } = await supabaseClient.rpc('is_admin', {
      check_user_id: user.id
    });

    if (!isAdmin) {
      return errorResponse("Unauthorized: admin access required", 403);
    }

    logger.log("[ADMIN-PROPOSAL] Creating official admin proposal:", {
      disputeId,
      proposalType,
      refundPercentage,
      immediateExecution,
    });

    // Get dispute details
    const { data: dispute, error: disputeError } = await adminClient
      .from("disputes")
      .select("*")
      .eq("id", disputeId)
      .single();

    if (disputeError || !dispute) {
      logger.error("Error fetching dispute:", disputeError);
      throw new Error("Dispute not found");
    }

    // Get transaction details separately
    const { data: transaction, error: transactionError } = await adminClient
      .from("transactions")
      .select("id, user_id, buyer_id, title, price, currency, stripe_payment_intent_id")
      .eq("id", dispute.transaction_id)
      .single();

    if (transactionError || !transaction) {
      logger.error("Error fetching transaction:", transactionError);
      throw new Error("Transaction not found");
    }

    // Validate dispute status
    if (!['open', 'negotiating', 'responded', 'escalated'].includes(dispute.status)) {
      throw new Error("Dispute cannot accept new proposals");
    }

    // Validate refund percentage for partial refunds
    if (proposalType === 'partial_refund' && (!refundPercentage || refundPercentage < 0 || refundPercentage > 100)) {
      throw new Error("Invalid refund percentage");
    }

    // If immediate execution, resolve directly via process-dispute logic
    if (immediateExecution) {
      logger.log("[ADMIN-PROPOSAL] Immediate execution requested, executing directly");
      
      // Determine action based on proposal type
      const action = (proposalType === 'full_refund' || proposalType === 'partial_refund') ? 'refund' : 'release';
      const finalRefundPercentage = proposalType === 'full_refund' ? 100 : (proposalType === 'partial_refund' ? refundPercentage : 0);

      // Build proposal text
      const proposalText = proposalType === 'partial_refund'
        ? `Remboursement de ${finalRefundPercentage}%`
        : proposalType === 'full_refund'
        ? 'Remboursement complet (100%)'
        : 'Pas de remboursement';

      // Import Stripe
      const Stripe = (await import("https://esm.sh/stripe@18.5.0")).default;
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2024-06-20",
      });

      const totalAmount = Math.round(transaction.price * 100);
      const platformFee = Math.round(totalAmount * 0.05);
      const currency = String(transaction.currency).toLowerCase();

      let paymentIntent = await stripe.paymentIntents.retrieve(transaction.stripe_payment_intent_id);
      let newTransactionStatus;
      let disputeStatus;

      if (action === 'refund') {
        const refundAmount = Math.round((totalAmount * finalRefundPercentage) / 100);
        const sellerAmount = totalAmount - refundAmount - platformFee;
        
        if (paymentIntent.status === 'requires_capture') {
          await stripe.paymentIntents.cancel(transaction.stripe_payment_intent_id);
          
          if (finalRefundPercentage < 100 && sellerAmount > 0) {
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
                metadata: { dispute_id: disputeId, type: 'immediate_partial_refund', refund_percentage: finalRefundPercentage }
              });
            }
          }
        } else if (paymentIntent.status === 'succeeded') {
          await stripe.refunds.create({
            payment_intent: transaction.stripe_payment_intent_id,
            amount: refundAmount,
            reason: 'requested_by_customer',
            metadata: { 
              dispute_id: disputeId, 
              admin_immediate: 'true', 
              type: finalRefundPercentage === 100 ? 'admin_full_refund' : 'admin_partial_refund',
              refund_percentage: finalRefundPercentage
            }
          });
          
          if (finalRefundPercentage < 100 && sellerAmount > 0) {
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
                metadata: { dispute_id: disputeId, type: 'immediate_partial_refund', refund_percentage: finalRefundPercentage }
              });
            }
          }
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
          paymentIntent = await stripe.paymentIntents.capture(transaction.stripe_payment_intent_id);
        }

        let chargeId = paymentIntent.latest_charge as string | null;
        if (!chargeId) {
          const refreshed = await stripe.paymentIntents.retrieve(transaction.stripe_payment_intent_id);
          paymentIntent = refreshed;
          chargeId = paymentIntent.latest_charge as string | null;
        }
        if (!chargeId) {
          throw new Error("No charge ID found in payment intent");
        }

        const transferAmount = totalAmount - platformFee;
        if (transferAmount > 0) {
          await stripe.transfers.create({
            amount: transferAmount,
            currency,
            destination: sellerAccount.stripe_account_id,
            source_transaction: chargeId,
            transfer_group: `txn_${transaction.id}`,
            description: `Admin immediate release for transaction ${transaction.id}`,
            metadata: { dispute_id: disputeId, type: 'admin_immediate_release' }
          });
        }

        newTransactionStatus = 'validated';
        disputeStatus = 'resolved_release';
      }

      // Update dispute
      const resolutionText = `Arbitrage immédiat: ${proposalType} - Message: ${message}`;
      await adminClient
        .from("disputes")
        .update({ 
          status: disputeStatus,
          resolved_at: new Date().toISOString(),
          resolution: resolutionText,
          updated_at: new Date().toISOString()
        })
        .eq("id", disputeId);

      // Update transaction
      const transactionUpdate: any = {
        status: newTransactionStatus,
        funds_released: action === 'release',
        funds_released_at: action === 'release' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      };

      if (action === 'refund') {
        transactionUpdate.refund_status = finalRefundPercentage === 100 ? 'full' : 'partial';
        transactionUpdate.refund_amount = Math.round((transaction.price * finalRefundPercentage) / 100);
      }

      await adminClient
        .from("transactions")
        .update(transactionUpdate)
        .eq("id", transaction.id);

      logger.log("[ADMIN-PROPOSAL] Immediate execution completed");

      // Send notification messages
      const { data: convs } = await adminClient.rpc(
        'create_escalated_dispute_conversations',
        {
          p_dispute_id: disputeId,
          p_admin_id: user.id,
        }
      );

      const sellerConvId = Array.isArray(convs) ? convs[0]?.seller_conversation_id : (convs as any)?.seller_conversation_id;
      const buyerConvId = Array.isArray(convs) ? convs[0]?.buyer_conversation_id : (convs as any)?.buyer_conversation_id;

      const immediateMessage = `⚡ DÉCISION ADMINISTRATIVE IMMÉDIATE\n\nL'équipe Rivvlock a arbitré ce litige et appliqué la solution suivante : ${proposalText}\n\n${message || ''}\n\n✅ Cette décision a été exécutée immédiatement.`;

      if (sellerConvId) {
        await adminClient.from("messages").insert({
          conversation_id: sellerConvId,
          sender_id: user.id,
          message: immediateMessage,
          message_type: 'system',
        });
      }

      if (buyerConvId) {
        await adminClient.from("messages").insert({
          conversation_id: buyerConvId,
          sender_id: user.id,
          message: immediateMessage,
          message_type: 'system',
        });
      }

      return successResponse({
        success: true,
        immediate_execution: true,
        dispute_status: disputeStatus,
      });
    }

    // Create the official admin proposal
    const { data: proposal, error: proposalInsertError } = await adminClient
      .from("dispute_proposals")
      .insert({
        dispute_id: disputeId,
        proposer_id: user.id,
        proposal_type: proposalType,
        refund_percentage: proposalType === 'partial_refund' ? refundPercentage : proposalType === 'full_refund' ? 100 : 0,
        message: message || null,
        status: 'pending',
        admin_created: true,
        requires_both_parties: true,
        buyer_validated: false,
        seller_validated: false,
        expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48h expiry
      })
      .select()
      .single();

    if (proposalInsertError || !proposal) {
      logger.error("Error creating proposal:", proposalInsertError);
      throw new Error("Failed to create proposal");
    }

    logger.log("[ADMIN-PROPOSAL] Proposal created:", proposal.id);

    // Update dispute status to negotiating
    await adminClient
      .from("disputes")
      .update({ 
        status: 'negotiating',
        updated_at: new Date().toISOString()
      })
      .eq("id", disputeId);

    // Create notification messages to both parties via unified conversations
    const proposalText = proposalType === 'partial_refund'
      ? `Remboursement de ${refundPercentage}%`
      : proposalType === 'full_refund'
      ? 'Remboursement complet (100%)'
      : 'Pas de remboursement';

    const systemMessage = `🔔 PROPOSITION OFFICIELLE DE L'ADMINISTRATION\n\nL'équipe Rivvlock propose la solution suivante : ${proposalText}\n\n${message || ''}\n\n⚠️ Les deux parties (acheteur et vendeur) doivent valider cette proposition pour qu'elle soit appliquée.\n\nVous avez 48 heures pour répondre.`;

    // Ensure admin conversations exist (idempotent via RPC)
    const { data: convs, error: convError } = await adminClient.rpc(
      'create_escalated_dispute_conversations',
      {
        p_dispute_id: disputeId,
        p_admin_id: user.id,
      }
    );

    if (convError) {
      logger.error("[ADMIN-PROPOSAL] Error ensuring conversations:", convError);
    }

    const sellerConvId = Array.isArray(convs)
      ? convs[0]?.seller_conversation_id
      : (convs as any)?.seller_conversation_id;
    const buyerConvId = Array.isArray(convs)
      ? convs[0]?.buyer_conversation_id
      : (convs as any)?.buyer_conversation_id;

    // Send messages to both conversations
    if (sellerConvId) {
      await adminClient
        .from("messages")
        .insert({
          conversation_id: sellerConvId,
          sender_id: user.id,
          message: systemMessage,
          message_type: 'system',
        });
      logger.log("[ADMIN-PROPOSAL] Message sent to seller conversation");
    }

    if (buyerConvId) {
      await adminClient
        .from("messages")
        .insert({
          conversation_id: buyerConvId,
          sender_id: user.id,
          message: systemMessage,
          message_type: 'system',
        });
      logger.log("[ADMIN-PROPOSAL] Message sent to buyer conversation");
    }

    logger.log("[ADMIN-PROPOSAL] Notification messages sent to both parties");

    // Note: activity_logs insertion removed to prevent constraint violation
    // Notifications will be sent via send-notifications function instead
    
    const participants = [transaction.user_id, transaction.buyer_id].filter(id => id);

    // Send notification to both parties
    try {
      const { error: notificationError } = await adminClient.functions.invoke('send-notifications', {
        body: {
          type: 'admin_dispute_proposal',
          transactionId: transaction.id,
          message: `🔔 L'administration a fait une proposition officielle pour le litige "${transaction.title}". ${proposalText}. Les deux parties doivent valider dans les 48h.`,
          recipients: participants
        }
      });
      
      if (notificationError) {
        logger.error("[ADMIN-PROPOSAL] Error sending notification:", notificationError);
      }
    } catch (notificationError) {
      logger.error("[ADMIN-PROPOSAL] Error invoking send-notifications:", notificationError);
    }

    return successResponse({ proposal });
  } catch (error) {
    logger.error("[ADMIN-PROPOSAL] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResponse(errorMessage, 500);
  }
};

const composedHandler = compose(
  withCors,
  withAuth,
  withRateLimit({ maxRequests: 30, windowMs: 60000 }),
  withValidation(adminProposalSchema)
)(handler);

serve(composedHandler);
