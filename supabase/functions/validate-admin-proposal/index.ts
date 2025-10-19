import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import {
  compose,
  withCors,
  withAuth,
  withRateLimit,
  withValidation,
  successResponse,
  errorResponse,
} from "../_shared/middleware.ts";
import { logger } from "../_shared/logger.ts";

const validateProposalSchema = z.object({
  proposalId: z.string().uuid(),
  action: z.enum(["accept", "reject"]),
});

const handler = async (ctx: any) => {
  try {
    const { user, supabaseClient, adminClient, body } = ctx;
    const { proposalId, action } = body;

    logger.log("[VALIDATE-ADMIN-PROPOSAL] User", user.id, action, "proposal", proposalId);

    // Get proposal
    const { data: proposal, error: proposalError } = await supabaseClient
      .from("dispute_proposals")
      .select("*")
      .eq("id", proposalId)
      .single();

    if (proposalError || !proposal) {
      logger.error("Error fetching proposal:", proposalError);
      return errorResponse("Proposal not found", 404);
    }

    if (!proposal.admin_created || !proposal.requires_both_parties) {
      return errorResponse("This is not an admin official proposal", 400);
    }

    // Get dispute
    const { data: dispute, error: disputeError } = await supabaseClient
      .from("disputes")
      .select("id, status, transaction_id")
      .eq("id", proposal.dispute_id)
      .single();

    if (disputeError || !dispute) {
      logger.error("Error fetching dispute:", disputeError);
      return errorResponse("Dispute not found", 404);
    }

    // Get transaction
    const { data: transaction, error: transactionError } = await supabaseClient
      .from("transactions")
      .select("id, user_id, buyer_id, stripe_payment_intent_id, price, currency, status, title")
      .eq("id", dispute.transaction_id)
      .single();

    if (transactionError || !transaction) {
      logger.error("Error fetching transaction:", transactionError);
      return errorResponse("Transaction not found", 404);
    }

    // Check user authorization
    const isSeller = user.id === transaction.user_id;
    const isBuyer = user.id === transaction.buyer_id;

    if (!isSeller && !isBuyer) {
      return errorResponse("User not authorized to validate this proposal", 403);
    }

    if (proposal.status !== "pending") {
      return errorResponse("Proposal is no longer pending", 400);
    }

    // Handle rejection
    if (action === "reject") {
      await adminClient
        .from("dispute_proposals")
        .update({
          status: "rejected",
          rejected_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", proposalId);

      await adminClient
        .from("disputes")
        .update({
          status: "escalated",
          updated_at: new Date().toISOString(),
        })
        .eq("id", dispute.id);

      // Send rejection message
      try {
        const { data: conversation } = await adminClient
          .from("conversations")
          .select("id")
          .eq("dispute_id", dispute.id)
          .eq("conversation_type", isSeller ? "admin_seller_dispute" : "admin_buyer_dispute")
          .maybeSingle();

        if (conversation) {
          await adminClient.from("messages").insert({
            conversation_id: conversation.id,
            sender_id: user.id,
            message: `❌ ${isSeller ? "Le vendeur" : "L'acheteur"} a rejeté la proposition officielle de l'administration.`,
            message_type: isSeller ? "seller_to_admin" : "buyer_to_admin",
          });
        }
      } catch (msgError) {
        logger.warn("Could not insert rejection message", msgError);
      }

      logger.log("[VALIDATE-ADMIN-PROPOSAL] Proposal rejected by", isSeller ? "seller" : "buyer");
      return successResponse({ status: "rejected" });
    }

    // Handle acceptance
    const updates: any = { updated_at: new Date().toISOString() };
    if (isSeller) {
      updates.seller_validated = true;
    } else if (isBuyer) {
      updates.buyer_validated = true;
    }

    await adminClient.from("dispute_proposals").update(updates).eq("id", proposalId);

    // Send validation message
    try {
      const { data: conversation } = await adminClient
        .from("conversations")
        .select("id")
        .eq("dispute_id", dispute.id)
        .eq("conversation_type", isSeller ? "admin_seller_dispute" : "admin_buyer_dispute")
        .maybeSingle();

      if (conversation) {
        await adminClient.from("messages").insert({
          conversation_id: conversation.id,
          sender_id: user.id,
          message: `✅ ${isSeller ? "Le vendeur" : "L'acheteur"} a validé la proposition officielle.`,
          message_type: isSeller ? "seller_to_admin" : "buyer_to_admin",
        });
      }
    } catch (msgError) {
      logger.warn("Could not insert validation message", msgError);
    }

    // Re-fetch proposal to check if both parties validated
    const { data: updatedProposal, error: refetchError } = await adminClient
      .from("dispute_proposals")
      .select("*")
      .eq("id", proposalId)
      .single();

    if (refetchError || !updatedProposal) {
      logger.error("Error refetching proposal:", refetchError);
      return errorResponse("Could not verify proposal status", 500);
    }

    // Check if both parties validated
    if (updatedProposal.buyer_validated && updatedProposal.seller_validated) {
      logger.log("[VALIDATE-ADMIN-PROPOSAL] Both parties validated - processing Stripe");

      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2024-06-20",
      });

      let disputeStatus: "resolved" | "resolved_refund" | "resolved_release" = "resolved";
      let newTransactionStatus = transaction.status;

      // Process based on proposal type
      if (
        proposal.proposal_type === "partial_refund" ||
        proposal.proposal_type === "full_refund"
      ) {
        if (!transaction.stripe_payment_intent_id) {
          return errorResponse("No payment intent found", 400);
        }

        const totalAmount = Math.round(transaction.price * 100);
        const refundPercentage = proposal.refund_percentage || 100;
        const isFullRefund = proposal.proposal_type === "full_refund" || refundPercentage === 100;

        logger.log(`Processing ${refundPercentage}% refund`);

        const paymentIntent = await stripe.paymentIntents.retrieve(
          transaction.stripe_payment_intent_id
        );

        if (paymentIntent.status === "requires_capture") {
          if (isFullRefund) {
            await stripe.paymentIntents.cancel(transaction.stripe_payment_intent_id);
            logger.log("Full refund - authorization cancelled");
          } else {
            // Partial refund: capture partial amount
            const platformFee = Math.round(totalAmount * 0.05);
            const capturePercentage = 100 - refundPercentage;
            const sellerShare = capturePercentage / 100;
            const sellerAmount = Math.round(totalAmount * sellerShare - platformFee * sellerShare);
            const captureAmount = sellerAmount + platformFee;
            const currency = String(transaction.currency).toLowerCase();

            const { data: sellerAccount } = await adminClient
              .from("stripe_accounts")
              .select("stripe_account_id")
              .eq("user_id", transaction.user_id)
              .maybeSingle();

            if (!sellerAccount?.stripe_account_id) {
              return errorResponse("Seller Stripe account not found", 400);
            }

            logger.log(`Capturing ${captureAmount / 100} ${currency}`);
            await stripe.paymentIntents.capture(transaction.stripe_payment_intent_id, {
              amount_to_capture: captureAmount,
            });

            if (sellerAmount > 0) {
              logger.log(`Transferring ${sellerAmount / 100} ${currency} to seller`);
              await stripe.transfers.create({
                amount: sellerAmount,
                currency,
                destination: sellerAccount.stripe_account_id,
                transfer_group: `txn_${transaction.id}`,
                metadata: { dispute_id: dispute.id, type: "admin_partial_refund" },
              });
            }

            logger.log(`Partial refund processed: ${refundPercentage}%`);
          }
        } else if (paymentIntent.status === "succeeded") {
          // Already captured - create refund
          const platformFee = Math.round(totalAmount * 0.05);
          const currency = String(transaction.currency).toLowerCase();
          const refundAmount = Math.round((totalAmount * refundPercentage) / 100);
          const sellerAmount = totalAmount - refundAmount - platformFee;

          if (isFullRefund) {
            await stripe.refunds.create({
              payment_intent: transaction.stripe_payment_intent_id,
              amount: refundAmount,
              reason: "requested_by_customer",
              metadata: { dispute_id: dispute.id, type: "admin_full_refund" },
            });
          } else {
            await stripe.refunds.create({
              payment_intent: transaction.stripe_payment_intent_id,
              amount: refundAmount,
              reason: "requested_by_customer",
              metadata: {
                dispute_id: dispute.id,
                type: "admin_partial_refund",
                refund_percentage: refundPercentage,
              },
            });

            if (sellerAmount > 0) {
              const { data: sellerAccount } = await adminClient
                .from("stripe_accounts")
                .select("stripe_account_id")
                .eq("user_id", transaction.user_id)
                .maybeSingle();

              let chargeId = paymentIntent.latest_charge as string | null;
              if (!chargeId) {
                const refreshed = await stripe.paymentIntents.retrieve(
                  transaction.stripe_payment_intent_id
                );
                chargeId = refreshed.latest_charge as string | null;
              }

              if (sellerAccount?.stripe_account_id && chargeId) {
                await stripe.transfers.create({
                  amount: sellerAmount,
                  currency,
                  destination: sellerAccount.stripe_account_id,
                  source_transaction: chargeId,
                  transfer_group: `txn_${transaction.id}`,
                  metadata: { dispute_id: dispute.id, type: "admin_partial_refund_transfer" },
                });
              }
            }
          }
        }

        disputeStatus = "resolved_refund";
        newTransactionStatus = "disputed";
      } else {
        // No refund - release funds to seller
        if (!transaction.stripe_payment_intent_id) {
          return errorResponse("No payment intent found", 400);
        }

        const { data: sellerAccount } = await adminClient
          .from("stripe_accounts")
          .select("stripe_account_id")
          .eq("user_id", transaction.user_id)
          .maybeSingle();

        if (!sellerAccount?.stripe_account_id) {
          return errorResponse("Seller Stripe account not found", 400);
        }

        let pi = await stripe.paymentIntents.retrieve(transaction.stripe_payment_intent_id);
        if (pi.status === "requires_capture") {
          pi = await stripe.paymentIntents.capture(transaction.stripe_payment_intent_id);
        }

        let chargeId = pi.latest_charge as string | null;
        if (!chargeId) {
          const refreshed = await stripe.paymentIntents.retrieve(
            transaction.stripe_payment_intent_id
          );
          chargeId = refreshed.latest_charge as string | null;
        }
        if (!chargeId) {
          return errorResponse("No charge ID found", 400);
        }

        const totalAmount = Math.round(transaction.price * 100);
        const platformFee = Math.round(totalAmount * 0.05);
        const transferAmount = totalAmount - platformFee;
        const currency = String(transaction.currency).toLowerCase();

        if (transferAmount > 0) {
          await stripe.transfers.create({
            amount: transferAmount,
            currency,
            destination: sellerAccount.stripe_account_id,
            source_transaction: chargeId,
            transfer_group: `txn_${transaction.id}`,
            description: `Admin release for transaction ${transaction.id}`,
            metadata: { dispute_id: dispute.id, type: "admin_release" },
          });
        }

        disputeStatus = "resolved_release";
        newTransactionStatus = "validated";
      }

      // Update dispute
      await adminClient
        .from("disputes")
        .update({
          status: disputeStatus,
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", dispute.id);

      // Update transaction
      const transactionUpdate: any = {
        status: newTransactionStatus,
        updated_at: new Date().toISOString(),
      };

      if (disputeStatus === "resolved_release") {
        transactionUpdate.funds_released = true;
        transactionUpdate.funds_released_at = new Date().toISOString();
      }

      if (disputeStatus === "resolved_refund") {
        transactionUpdate.refund_status =
          proposal.proposal_type === "full_refund" ? "full" : "partial";
        transactionUpdate.refund_amount = Math.round(
          (transaction.price * (proposal.refund_percentage || 100)) / 100
        );
      }

      await adminClient.from("transactions").update(transactionUpdate).eq("id", transaction.id);

      // Send confirmation messages
      try {
        const confirmationText =
          proposal.proposal_type === "partial_refund"
            ? `✅ Proposition officielle appliquée: remboursement de ${proposal.refund_percentage}%`
            : proposal.proposal_type === "full_refund"
            ? "✅ Proposition officielle appliquée: remboursement complet (100%)"
            : "✅ Proposition officielle appliquée: pas de remboursement";

        const { data: sellerConv } = await adminClient
          .from("conversations")
          .select("id")
          .eq("dispute_id", dispute.id)
          .eq("conversation_type", "admin_seller_dispute")
          .maybeSingle();

        const { data: buyerConv } = await adminClient
          .from("conversations")
          .select("id")
          .eq("dispute_id", dispute.id)
          .eq("conversation_type", "admin_buyer_dispute")
          .maybeSingle();

        if (sellerConv) {
          await adminClient.from("messages").insert({
            conversation_id: sellerConv.id,
            sender_id: user.id,
            message: confirmationText,
            message_type: "admin_to_seller",
          });
        }

        if (buyerConv) {
          await adminClient.from("messages").insert({
            conversation_id: buyerConv.id,
            sender_id: user.id,
            message: confirmationText,
            message_type: "admin_to_buyer",
          });
        }
      } catch (msgError) {
        logger.warn("Could not insert confirmation messages", msgError);
      }

      logger.log("[VALIDATE-ADMIN-PROPOSAL] Proposal fully accepted and processed");

      return successResponse({
        success: true,
        status: "accepted",
        both_validated: true,
        dispute_status: disputeStatus,
      });
    }

    // Only one party validated
    logger.log("[VALIDATE-ADMIN-PROPOSAL] Validation recorded, waiting for other party");

    const otherParticipantId =
      user.id === transaction.user_id ? transaction.buyer_id : transaction.user_id;

    if (otherParticipantId) {
      await adminClient.from("activity_logs").insert({
        user_id: otherParticipantId,
        activity_type: "dispute_proposal_accepted",
        title: `Validation de proposition pour "${transaction.title}"`,
        description:
          "L'autre partie a validé la proposition officielle de l'administration. En attente de votre validation.",
        metadata: {
          dispute_id: dispute.id,
          transaction_id: transaction.id,
          proposal_id: proposalId,
        },
      });
    }

    return successResponse({
      success: true,
      status: "pending",
      both_validated: false,
      seller_validated: updatedProposal.seller_validated,
      buyer_validated: updatedProposal.buyer_validated,
    });
  } catch (error) {
    logger.error("[VALIDATE-ADMIN-PROPOSAL] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResponse(errorMessage, 500);
  }
};

const composedHandler = compose(
  withCors,
  withAuth,
  withRateLimit({ maxRequests: 30, windowMs: 60000 }),
  withValidation(validateProposalSchema)
)(handler);

serve(composedHandler);
