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

const schema = z.object({
  proposalId: z.string().uuid(),
});

function log(step: string, data?: Record<string, unknown>) {
  logger.log(`[FINALIZE-ADMIN-PROPOSAL] ${step}`, data ? JSON.stringify(data) : "");
}

const handler = async (_req: Request, ctx: any) => {
  const { user, supabaseClient, adminClient, body } = ctx;
  const { proposalId } = body as { proposalId: string };

  try {
    log("Start", { proposalId, userId: user?.id });

    // Load proposal with dispute + transaction
    const { data: proposal, error: propErr } = await adminClient
      .from("dispute_proposals")
      .select(
        `*, dispute:disputes(*, transactions:transactions(*))`
      )
      .eq("id", proposalId)
      .maybeSingle();

    if (propErr || !proposal) {
      log("Proposal not found", { error: propErr });
      return errorResponse("Proposal not found", 404);
    }

    // Security: ensure caller is a participant of the transaction
    const tx = proposal.dispute?.transactions;
    if (!tx) return errorResponse("Related transaction not found", 400);

    const isParticipant = [tx.user_id, tx.buyer_id].includes(user.id);
    if (!isParticipant) {
      return errorResponse("Unauthorized", 403);
    }

    // Only admin-created proposals are supported here
    if (!proposal.admin_created) {
      return errorResponse("Not an admin-created proposal", 400);
    }

    // Must be both validated
    if (!(proposal.buyer_validated && proposal.seller_validated)) {
      return errorResponse("Both parties not validated yet", 400);
    }

    // Idempotency: if proposal already accepted, or dispute already resolved, or tx already finalized
    const dispute = proposal.dispute;
    if (!dispute) return errorResponse("Dispute not found", 404);
    if (proposal.status === "accepted" || (dispute.status && String(dispute.status).startsWith("resolved"))) {
      // Ensure proposal marked accepted for consistency
      if (proposal.status !== "accepted") {
        await adminClient.from("dispute_proposals").update({ status: "accepted" }).eq("id", proposalId);
      }
      return successResponse({ status: "already_finalized" });
    }

    // Compute action from proposal_type
    let action: "refund" | "release" = "refund";
    let refundPercentage = 100;
    if (proposal.proposal_type === "no_refund") action = "release";
    if (proposal.proposal_type === "partial_refund") {
      action = "refund";
      refundPercentage = Number(proposal.refund_percentage ?? 0);
    }
    if (proposal.proposal_type === "full_refund") {
      action = "refund";
      refundPercentage = 100;
    }

    // Stripe / statuses processing (inline minimal copy of process-dispute logic)
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
    if (!stripeKey) return errorResponse("Stripe not configured", 500);
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    if (!tx.stripe_payment_intent_id) {
      return errorResponse("No payment intent found for this transaction", 400);
    }

    let paymentIntent = await stripe.paymentIntents.retrieve(tx.stripe_payment_intent_id);

    const totalAmount = Math.round(Number(tx.price) * 100);
    const platformFee = Math.round(totalAmount * 0.05);
    const currency = String(tx.currency).toLowerCase();

    let newTransactionStatus: "validated" | "disputed" = "disputed";
    let disputeStatus: "resolved_refund" | "resolved_release" = "resolved_refund";

    if (action === "refund") {
      const refundAmount = Math.round((totalAmount * (refundPercentage ?? 100)) / 100);
      const sellerAmount = totalAmount - refundAmount - platformFee;

      if (paymentIntent.status === "requires_capture") {
        // Full vs partial refund handling on uncaptured PI
        if ((refundPercentage ?? 100) === 100) {
          // Full refund: cancel authorization
          await stripe.paymentIntents.cancel(tx.stripe_payment_intent_id);
        } else {
          // Partial refund: capture seller share + platform fee, then transfer seller share from the charge
          const capturePercentage = 100 - (refundPercentage ?? 100);
          const sellerShare = capturePercentage / 100;
          const sellerAmount = Math.max(0, Math.round(totalAmount * sellerShare - Math.round(platformFee * sellerShare)));
          const captureAmount = sellerAmount + platformFee;

          const captured = await stripe.paymentIntents.capture(tx.stripe_payment_intent_id, {
            amount_to_capture: captureAmount,
          });

          // Retrieve charge id for source_transaction based transfer
          let chargeId = captured.latest_charge as string | null;
          if (!chargeId) {
            const refreshed = await stripe.paymentIntents.retrieve(tx.stripe_payment_intent_id);
            chargeId = refreshed.latest_charge as string | null;
          }

          if (sellerAmount > 0 && chargeId) {
            const { data: sellerAccount } = await adminClient
              .from("stripe_accounts")
              .select("stripe_account_id")
              .eq("user_id", tx.user_id)
              .maybeSingle();
            if (sellerAccount?.stripe_account_id) {
              await stripe.transfers.create({
                amount: sellerAmount,
                currency,
                destination: sellerAccount.stripe_account_id,
                source_transaction: chargeId,
                transfer_group: `txn_${tx.id}`,
                metadata: { dispute_id: dispute.id, type: "partial_refund_seller_share", refund_percentage: String(refundPercentage) },
              });
            }
          }
        }
      }
      } else if (paymentIntent.status === "succeeded") {
        // Avoid over-refund by clamping to remaining refundable amount
        const refundsList = await stripe.refunds.list({ payment_intent: tx.stripe_payment_intent_id, limit: 100 });
        const alreadyRefunded = refundsList.data.reduce((sum, r) => sum + (r.amount || 0), 0);
        const amountReceived = paymentIntent.amount_received ?? totalAmount;
        const remainingRefundable = Math.max(0, amountReceived - alreadyRefunded);
        const effectiveRefund = Math.min(refundAmount, remainingRefundable);

        if (effectiveRefund > 0) {
          await stripe.refunds.create({
            payment_intent: tx.stripe_payment_intent_id,
            amount: effectiveRefund,
            reason: "requested_by_customer",
            metadata: { dispute_id: dispute.id, admin_official: "true", type: (refundPercentage ?? 100) === 100 ? "admin_full_refund" : "admin_partial_refund", refund_percentage: String(refundPercentage) },
          });
        }

        if ((refundPercentage ?? 100) < 100 && sellerAmount > 0) {
          const { data: sellerAccount } = await adminClient
            .from("stripe_accounts")
            .select("stripe_account_id")
            .eq("user_id", tx.user_id)
            .maybeSingle();

          // Use source_transaction to avoid platform balance dependency
          let chargeId = paymentIntent.latest_charge as string | null;
          if (!chargeId) {
            const refreshed = await stripe.paymentIntents.retrieve(tx.stripe_payment_intent_id);
            chargeId = refreshed.latest_charge as string | null;
          }

          if (sellerAccount?.stripe_account_id && chargeId) {
            await stripe.transfers.create({
              amount: sellerAmount,
              currency,
              destination: sellerAccount.stripe_account_id,
              source_transaction: chargeId,
              transfer_group: `txn_${tx.id}`,
              metadata: { dispute_id: dispute.id, type: "partial_refund_seller_share", refund_percentage: String(refundPercentage) },
            });
          }
        }
      }
        }
      } else {
        return errorResponse(`PaymentIntent not refundable in status: ${paymentIntent.status}`, 400);
      }

      newTransactionStatus = "disputed";
      disputeStatus = "resolved_refund";
    } else {
      // release
      const { data: sellerAccount } = await adminClient
        .from("stripe_accounts")
        .select("stripe_account_id")
        .eq("user_id", tx.user_id)
        .maybeSingle();
      if (!sellerAccount?.stripe_account_id) {
        return errorResponse("Seller Stripe account not found", 400);
      }

      if (paymentIntent.status === "requires_capture") {
        paymentIntent = await stripe.paymentIntents.capture(tx.stripe_payment_intent_id);
      } else if (paymentIntent.status !== "succeeded") {
        return errorResponse(`PaymentIntent not capturable in status: ${paymentIntent.status}`, 400);
      }

      let chargeId = paymentIntent.latest_charge as string | null;
      if (!chargeId) {
        const refreshed = await stripe.paymentIntents.retrieve(tx.stripe_payment_intent_id);
        paymentIntent = refreshed;
        chargeId = paymentIntent.latest_charge as string | null;
      }
      if (!chargeId) return errorResponse("No charge ID found in payment intent", 400);

      const transferAmount = totalAmount - platformFee;
      if (transferAmount > 0) {
        await stripe.transfers.create({
          amount: transferAmount,
          currency,
          destination: sellerAccount.stripe_account_id,
          source_transaction: chargeId,
          transfer_group: `txn_${tx.id}`,
          description: `Admin release for transaction ${tx.id}`,
          metadata: { dispute_id: dispute.id, type: "admin_release_transfer" },
        });
      }

      newTransactionStatus = "validated";
      disputeStatus = "resolved_release";
    }

    // Update dispute
    const resolutionText = action === "refund"
      ? `Décision administrative: ${(refundPercentage ?? 100) === 100 ? "full_refund" : "partial_refund"} - ${refundPercentage ?? 100}% refund`
      : `Décision administrative: no_refund - 0% refund`;

    await adminClient
      .from("disputes")
      .update({
        status: disputeStatus,
        resolved_at: new Date().toISOString(),
        resolution: resolutionText,
        updated_at: new Date().toISOString(),
      })
      .eq("id", dispute.id);

    // Update transaction
    const txUpdate: any = {
      status: newTransactionStatus,
      funds_released: action === "release",
      funds_released_at: action === "release" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };
    if (action === "refund") {
      txUpdate.refund_status = (refundPercentage ?? 100) === 100 ? "full" : "partial";
      txUpdate.refund_amount = Math.round((Number(tx.price) * (refundPercentage ?? 100)) / 100);
    }
    const { error: txErr } = await adminClient.from("transactions").update(txUpdate).eq("id", tx.id);
    if (txErr) {
      log("Transaction update error", { error: txErr });
      return errorResponse("Failed to update transaction", 500);
    }

    // Mark proposal accepted
    await adminClient.from("dispute_proposals").update({ status: "accepted" }).eq("id", proposalId);

    return successResponse({
      status: "accepted",
      dispute_status: disputeStatus,
      transaction_status: newTransactionStatus,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log("Unhandled error", { message });
    return errorResponse(message || "Unexpected server error", 500);
  }
};

const composedHandler = compose(
  withCors,
  withAuth,
  withRateLimit({ maxRequests: 30, windowMs: 60000 }),
  withValidation(schema)
)(handler);

serve(composedHandler);
