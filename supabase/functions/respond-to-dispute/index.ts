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

const respondToDisputeSchema = z.object({
  disputeId: z.string().uuid(),
  response: z.string().min(1),
});

const handler = async (ctx: any) => {
  const { user, adminClient, body } = ctx;
  const { disputeId, response } = body;
  
  logger.log('[RESPOND-TO-DISPUTE] Processing dispute response', { disputeId, responseLength: response.length });

  // ✅ SYSTÈME UNIFIÉ: Récupérer le dispute (conversation_id garanti)
  const { data: dispute, error: disputeError } = await adminClient
    .from("disputes")
    .select("*")
    .eq("id", disputeId)
    .single();

  if (disputeError || !dispute) {
    logger.log('[RESPOND-TO-DISPUTE] Dispute not found', disputeError);
    return errorResponse("Dispute not found", 404);
  }

  // Get transaction separately
  const { data: transaction, error: transactionError } = await adminClient
    .from("transactions")
    .select("*")
    .eq("id", dispute.transaction_id)
    .single();

  if (transactionError || !transaction) {
    logger.log('[RESPOND-TO-DISPUTE] Transaction not found', transactionError);
    return errorResponse("Transaction not found", 404);
  }
  
  // Verify user is the seller of the transaction
  if (transaction.user_id !== user.id) {
    logger.log('[RESPOND-TO-DISPUTE] Unauthorized - user is not the seller', { 
      userId: user.id, 
      sellerId: transaction.user_id 
    });
    return errorResponse("Only the seller can respond to this dispute", 403);
  }

  // ✅ Envoyer la réponse via la conversation unifiée (garantie d'exister)
  if (!dispute.conversation_id) {
    logger.log('[RESPOND-TO-DISPUTE] ERREUR: conversation_id manquant (ne devrait jamais arriver)');
    return errorResponse("Erreur système: conversation manquante", 500);
  }

  const { error: messageError } = await adminClient
    .from('messages')
    .insert({
      conversation_id: dispute.conversation_id,
      sender_id: user.id,
      message: response.trim(),
      message_type: 'text'
    });

  if (messageError) {
    logger.log('[RESPOND-TO-DISPUTE] Error sending message', messageError);
    throw messageError;
  }

  // Update dispute status to 'responded'
  const { error: updateError } = await adminClient
    .from("disputes")
    .update({
      status: 'responded',
      updated_at: new Date().toISOString()
    })
    .eq("id", disputeId);

  if (updateError) {
    logger.log('[RESPOND-TO-DISPUTE] Error updating dispute status', updateError);
    throw updateError;
  }

  logger.log('[RESPOND-TO-DISPUTE] ✅ Response sent via unified messaging');

  // Log activity
  const { error: activityError } = await adminClient
    .from('activity_logs')
    .insert({
      user_id: user.id,
      activity_type: 'dispute_created',
      title: `Réponse au litige sur "${transaction.title}"`,
      description: `Le vendeur a répondu au litige`,
      metadata: {
        dispute_id: disputeId,
        transaction_id: transaction.id,
        response_length: response.length
      }
    });

  if (activityError) {
    logger.log('[RESPOND-TO-DISPUTE] Error logging activity', activityError);
  }

  // Send notification to the reporter (buyer who created the dispute)
  try {
    const { error: notificationError } = await adminClient.functions.invoke('send-notifications', {
      body: {
        type: 'dispute_response',
        transactionId: transaction.id,
        message: `Le vendeur a répondu à votre litige concernant "${transaction.title}". Consultez la transaction pour voir la réponse.`,
        recipients: [dispute.reporter_id]
      }
    });
    
    if (notificationError) {
      logger.log('[RESPOND-TO-DISPUTE] Error sending notification', notificationError);
    } else {
      logger.log('[RESPOND-TO-DISPUTE] Notification sent to dispute reporter');
    }
  } catch (error) {
    logger.log('[RESPOND-TO-DISPUTE] Error invoking notification function', error);
  }

  return successResponse({ 
    message: "Response submitted successfully"
  });
};

const composedHandler = compose(
  withCors,
  withAuth,
  withRateLimit({ maxRequests: 10, windowMs: 60000 }),
  withValidation(respondToDisputeSchema)
)(handler);

serve(composedHandler);
