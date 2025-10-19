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
    const { proposalId, action } = body as z.infer<typeof validateProposalSchema>;

    logger.log("[VALIDATE-ADMIN-PROPOSAL] User", user.id, action, "proposal", proposalId);

    // Load proposal
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

    // Load dispute
    const { data: dispute, error: disputeError } = await supabaseClient
      .from("disputes")
      .select("id, status, transaction_id, conversation_id")
      .eq("id", proposal.dispute_id)
      .single();

    if (disputeError || !dispute) {
      logger.error("Error fetching dispute:", disputeError);
      return errorResponse("Dispute not found", 404);
    }

    // Load transaction
    const { data: transaction, error: transactionError } = await supabaseClient
      .from("transactions")
      .select(
        "id, user_id, buyer_id, stripe_payment_intent_id, price, currency, status, title"
      )
      .eq("id", dispute.transaction_id)
      .single();

    if (transactionError || !transaction) {
      logger.error("Error fetching transaction:", transactionError);
      return errorResponse("Transaction not found", 404);
    }

    const isSeller = user.id === transaction.user_id;
    const isBuyer = user.id === transaction.buyer_id;
    if (!isSeller && !isBuyer) {
      return errorResponse("User not authorized to validate this proposal", 403);
    }

    if (proposal.status !== "pending") {
      return errorResponse("Proposal is no longer pending", 400);
    }

    if (action === "reject") {
      await adminClient
        .from("dispute_proposals")
        .update({
          status: "rejected",
          rejected_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", proposalId);

      // Return dispute to escalated state
      await adminClient
        .from("disputes")
        .update({ status: "escalated", updated_at: new Date().toISOString() })
        .eq("id", dispute.id);

      // Notify in appropriate admin conversation
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
        logger.warn("Non-critical: Could not insert rejection message", msgError);
      }

      return successResponse({ status: "rejected" });
    }

    // Accept flow: mark party as validated
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (isSeller) updates.seller_validated = true;
    if (isBuyer) updates.buyer_validated = true;

    await adminClient.from("dispute_proposals").update(updates).eq("id", proposalId);

    // Re-fetch proposal to ensure flags are current
    const { data: updatedProposal } = await adminClient
      .from("dispute_proposals")
      .select("*")
      .eq("id", proposalId)
      .single();

    // If both parties validated, execute decision
    if (updatedProposal?.buyer_validated && updatedProposal?.seller_validated) {
      logger.log("[VALIDATE-ADMIN-PROPOSAL] Both parties validated - processing Stripe");

      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2024-06-20",
      });

      let disputeStatus: "resolved_refund" | "resolved_release" | "resolved" = "resolved";
      let newTransactionStatus = transaction.status as string;

      const totalAmount = Math.round((transaction.price ?? 0) * 100);
      const platformFee = Math.round(totalAmount * 0.05);
      const currency = String(transaction.currency).toLowerCase();

      if (
        updatedProposal.proposal_type === "full_refund" ||
        updatedProposal.proposal_type === "partial_refund"
      ) {
        if (!transaction.stripe_payment_intent_id) {
          return errorResponse("No payment intent found for this transaction", 400);
        }

        const refundPercentage =
          updatedProposal.proposal_type === "full_refund"
            ? 100
            : updatedProposal.refund_percentage ?? 0;
        const refundAmount = Math.round((totalAmount * refundPercentage) / 100);
        const sellerAmount = totalAmount - refundAmount - platformFee;

        const pi = await stripe.paymentIntents.retrieve(
          transaction.stripe_payment_intent_id
        );

        if (pi.status === "requires_capture") {
          if (refundPercentage === 100) {
            await stripe.paymentIntents.cancel(transaction.stripe_payment_intent_id);
          } else {
            // Partial: capture seller share + platform fee, then transfer sellerAmount
            const { data: sellerAccount } = await adminClient
              .from("stripe_accounts")
              .select("stripe_account_id")
              .eq("user_id", transaction.user_id)
              .maybeSingle();

            await stripe.paymentIntents.capture(
              transaction.stripe_payment_intent_id,
              { amount_to_capture: sellerAmount + platformFee }
            );

            if (sellerAmount > 0 && sellerAccount?.stripe_account_id) {
              await stripe.transfers.create({
                amount: sellerAmount,
                currency,
                destination: sellerAccount.stripe_account_id,
                transfer_group: `txn_${transaction.id}`,
                metadata: {
                  dispute_id: dispute.id,
                  type: "admin_partial_refund_transfer",
                },
              });
            }
          }
        } else if (pi.status === "succeeded") {
          await stripe.refunds.create({
            payment_intent: transaction.stripe_payment_intent_id,
            amount: refundAmount,
            reason: "requested_by_customer",
            metadata: {
              dispute_id: dispute.id,
              type: refundPercentage === 100 ? "admin_full_refund" : "admin_partial_refund",
              refund_percentage: refundPercentage,
            },
          });

          if (refundPercentage < 100 && sellerAmount > 0) {
            const { data: sellerAccount } = await adminClient
              .from("stripe_accounts")
              .select("stripe_account_id")
              .eq("user_id", transaction.user_id)
              .maybeSingle();

            // Ensure we have a charge to link the transfer
            let chargeId = pi.latest_charge as string | null;
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
                metadata: {
                  dispute_id: dispute.id,
                  type: "admin_partial_refund_transfer",
                },
              });
            }
          }
        }

        disputeStatus = "resolved_refund";
        newTransactionStatus = "disputed";
      } else {
        // No refund => release funds to seller
        if (!transaction.stripe_payment_intent_id) {
          return errorResponse("No payment intent found for this transaction", 400);
        }

        const { data: sellerAccount } = await adminClient
          .from("stripe_accounts")
          .select("stripe_account_id")
          .eq("user_id", transaction.user_id)
          .maybeSingle();

        if (!sellerAccount?.stripe_account_id) {
          return errorResponse("Seller Stripe account not found", 400);
        }

        let pi = await stripe.paymentIntents.retrieve(
          transaction.stripe_payment_intent_id
        );
        if (pi.status === "requires_capture") {
          pi = await stripe.paymentIntents.capture(
            transaction.stripe_payment_intent_id
          );
        }

        let chargeId = pi.latest_charge as string | null;
        if (!chargeId) {
          const refreshed = await stripe.paymentIntents.retrieve(
            transaction.stripe_payment_intent_id
          );
          chargeId = refreshed.latest_charge as string | null;
        }
        if (!chargeId) {
          return errorResponse("No charge ID found in payment intent", 400);
        }

        const transferAmount = totalAmount - platformFee;
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

      // Persist dispute + transaction updates
      await adminClient
        .from("disputes")
        .update({
          status: disputeStatus,
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", dispute.id);

      const txUpdate: Record<string, any> = {
        status: newTransactionStatus,
        updated_at: new Date().toISOString(),
      };
      if (disputeStatus === "resolved_release") {
        txUpdate.funds_released = true;
        txUpdate.funds_released_at = new Date().toISOString();
      }
      if (disputeStatus === "resolved_refund") {
        txUpdate.refund_status =
          updatedProposal.proposal_type === "full_refund" ? "full" : "partial";
        txUpdate.refund_amount = Math.round(
          (transaction.price * (updatedProposal.refund_percentage ?? 100)) / 100
        );
      }

      await adminClient.from("transactions").update(txUpdate).eq("id", transaction.id);

      // Notify both parties via admin conversations if present
      try {
        const confirmationText =
          updatedProposal.proposal_type === "partial_refund"
            ? `✅ Proposition officielle appliquée: remboursement de ${updatedProposal.refund_percentage}%`
            : updatedProposal.proposal_type === "full_refund"
            ? "✅ Proposition officielle appliquée: remboursement complet (100%)"
            : "✅ Proposition officielle appliquée: pas de remboursement (fonds libérés)";

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
        logger.warn("Non-critical: Could not insert confirmation messages", msgError);
      }

      return successResponse({
        success: true,
        status: "accepted",
        both_validated: true,
        dispute_status: disputeStatus,
      });
    }

    // One party validated only
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
      seller_validated: updatedProposal?.seller_validated ?? false,
      buyer_validated: updatedProposal?.buyer_validated ?? false,
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
