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

const createProposalSchema = z.object({
  disputeId: z.string().uuid(),
  proposalType: z.enum(['partial_refund', 'full_refund', 'no_refund']),
  refundPercentage: z.number().min(0).max(100).optional(),
  message: z.string().optional(),
});

const handler = async (_req: Request, ctx: any) => {
  const { user, adminClient, body } = ctx;
  const { disputeId, proposalType, refundPercentage, message } = body;

  logger.log("Creating proposal:", { disputeId, proposalType, refundPercentage, userId: user.id });

  // Get the dispute
  const { data: dispute, error: disputeError } = await adminClient
    .from("disputes")
    .select("*")
    .eq("id", disputeId)
    .single();

  if (disputeError || !dispute) {
    logger.error("Error fetching dispute:", disputeError);
    return errorResponse("Dispute not found", 404);
  }

  // Get the associated transaction
  const { data: transaction, error: transactionError } = await adminClient
    .from("transactions")
    .select("*")
    .eq("id", dispute.transaction_id)
    .single();

  if (transactionError || !transaction) {
    logger.error("Error fetching transaction:", transactionError);
    return errorResponse("Transaction not found", 404);
  }

  const isInvolved = 
    user.id === dispute.reporter_id ||
    user.id === transaction.user_id ||
    user.id === transaction.buyer_id;

  if (!isInvolved) {
    return errorResponse("User not authorized to make proposals in this dispute", 403);
  }

  if (!['open', 'responded', 'negotiating'].includes(dispute.status)) {
    return errorResponse("Cannot make proposals on closed disputes", 400);
  }

  // Create the proposal
  const { data: proposal, error: proposalError } = await adminClient
    .from("dispute_proposals")
    .insert({
      dispute_id: disputeId,
      proposer_id: user.id,
      proposal_type: proposalType,
      refund_percentage: refundPercentage,
      message: message,
    })
    .select()
    .single();

  if (proposalError) {
    logger.error("Error creating proposal:", proposalError);
    throw proposalError;
  }

  logger.log("✅ Proposal created successfully:", proposal.id);

  // Create a message in the dispute to notify the other party
  let proposalText = '';
  if (proposalType === 'partial_refund') {
    proposalText = `Proposition officielle : Remboursement de ${refundPercentage}%`;
  } else if (proposalType === 'full_refund') {
    proposalText = `Proposition officielle : Remboursement intégral (100%)`;
  } else if (proposalType === 'no_refund') {
    proposalText = `Proposition officielle : Aucun remboursement`;
  } else {
    proposalText = `Proposition officielle : ${proposalType}`;
  }

  // Write to unified conversations/messages if a conversation exists
  if (dispute.conversation_id) {
    try {
      const { error: msgError } = await adminClient
        .from('messages')
        .insert({
          conversation_id: dispute.conversation_id,
          sender_id: user.id,
          message: proposalText + (message ? `\n${message}` : ''),
          message_type: 'system',
          metadata: {
            proposal_id: proposal.id,
            proposal_type: proposalType,
            refund_percentage: refundPercentage,
            dispute_id: disputeId,
            transaction_id: transaction.id,
          },
        });
      
      if (msgError) {
        logger.error("Error inserting message:", msgError);
      }
    } catch (error) {
      logger.error("Exception inserting message:", error);
    }
  }

  // Log activity for all other participants
  const participants = [transaction.user_id, transaction.buyer_id].filter(id => id && id !== user.id);
  
  for (const participantId of participants) {
    try {
      const { error: logError } = await adminClient.from('activity_logs').insert({
        user_id: participantId,
        activity_type: 'dispute_proposal_created',
        title: `Nouvelle proposition dans le litige "${transaction.title}"`,
        description: proposalText,
        metadata: {
          dispute_id: disputeId,
          transaction_id: transaction.id,
          proposal_id: proposal.id,
          proposal_type: proposalType
        }
      });
      
      if (logError) {
        logger.error("Error inserting activity log:", logError);
      }
    } catch (error) {
      logger.error("Exception inserting activity log:", error);
    }
  }

  // Send notification to all other participants
  try {
    const { error: notificationError } = await adminClient.functions.invoke('send-notifications', {
      body: {
        type: 'dispute_proposal_created',
        transactionId: transaction.id,
        message: `Une nouvelle proposition a été faite dans le litige concernant "${transaction.title}". ${proposalText}${message ? ` - ${message}` : ''}`,
        recipients: participants
      }
    });
    
    if (notificationError) {
      logger.error("Error sending notification:", notificationError);
    }
  } catch (notificationError) {
    logger.error("Error invoking send-notifications:", notificationError);
  }

  return successResponse({ proposal });
};

const composedHandler = compose(
  withCors,
  withAuth,
  withRateLimit({ maxRequests: 20, windowMs: 60000 }),
  withValidation(createProposalSchema)
)(handler);

serve(composedHandler);
