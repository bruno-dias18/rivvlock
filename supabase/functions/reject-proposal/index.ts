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

const rejectProposalSchema = z.object({
  proposalId: z.string().uuid(),
});

const handler = async (ctx: any) => {
  const { user, supabaseClient, adminClient, body } = ctx;
  const { proposalId } = body;
  
  logger.log("Rejecting proposal:", proposalId);

  // Get the proposal
  const { data: proposal, error: proposalError } = await supabaseClient
    .from("dispute_proposals")
    .select(`
      *,
      disputes (
        *,
        transactions (*)
      )
    `)
    .eq("id", proposalId)
    .single();

  if (proposalError || !proposal) {
    logger.error("Error fetching proposal:", proposalError);
    return errorResponse("Proposal not found", 404);
  }

  const dispute = proposal.disputes;
  const transaction = dispute.transactions;

  // Verify user is involved
  const isInvolved = 
    user.id === dispute.reporter_id ||
    user.id === transaction.user_id ||
    user.id === transaction.buyer_id;

  if (!isInvolved) {
    return errorResponse("User not authorized to reject this proposal", 403);
  }

  // Verify user is not the proposer
  if (user.id === proposal.proposer_id) {
    return errorResponse("Cannot reject your own proposal", 400);
  }

  // Update proposal status to rejected
  const { error: updateError } = await supabaseClient
    .from("dispute_proposals")
    .update({ 
      status: "rejected",
      updated_at: new Date().toISOString()
    })
    .eq("id", proposalId);

  if (updateError) {
    logger.error("Error updating proposal:", updateError);
    throw updateError;
  }

  logger.log("✅ Proposal rejected successfully");

  // Create a message in the dispute conversation
  const proposalText = proposal.proposal_type === 'partial_refund'
    ? `Remboursement de ${proposal.refund_percentage}%`
    : proposal.proposal_type === 'full_refund'
    ? 'Remboursement intégral (100%)'
    : 'Aucun remboursement';

  if (dispute.conversation_id) {
    await supabaseClient
      .from("messages")
      .insert({
        conversation_id: dispute.conversation_id,
        sender_id: user.id,
        message: `❌ Proposition refusée : ${proposalText}`,
        message_type: "text",
      });
  }

  // Log activity for proposer
  await supabaseClient.from('activity_logs').insert({
    user_id: proposal.proposer_id,
    activity_type: 'dispute_proposal_rejected',
    title: `Votre proposition a été refusée - "${transaction.title}"`,
    description: `La proposition "${proposalText}" a été refusée`,
    metadata: {
      dispute_id: dispute.id,
      transaction_id: transaction.id,
      proposal_id: proposalId,
    }
  });

  // Send notification to proposer
  try {
    await adminClient!.functions.invoke('send-notifications', {
      body: {
        type: 'dispute_proposal_rejected',
        transactionId: transaction.id,
        message: `Votre proposition "${proposalText}" concernant "${transaction.title}" a été refusée`,
        recipients: [proposal.proposer_id]
      }
    });
  } catch (notificationError) {
    logger.error("Error sending notification:", notificationError);
  }

  return successResponse({ 
    message: "Proposition refusée avec succès"
  });
};

const composedHandler = compose(
  withCors,
  withAuth,
  withRateLimit({ maxRequests: 10, windowMs: 60000 }),
  withValidation(rejectProposalSchema)
)(handler);

serve(composedHandler);
