import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { 
  compose, 
  withCors, 
  withAuth, 
  withValidation,
  successResponse, 
  errorResponse,
  Handler, 
  HandlerContext 
} from "../_shared/middleware.ts";
import { logger } from "../_shared/logger.ts";

const ensureConversationSchema = z.object({
  transactionId: z.string().uuid(),
});

const handler: Handler = async (_req, ctx: HandlerContext) => {
  const { user, supabaseClient, adminClient, body } = ctx;
  const { transactionId } = body;

  try {
    // Get transaction
    const { data: transaction, error: txError } = await adminClient!
      .from('transactions')
      .select('id, user_id, buyer_id, conversation_id, status')
      .eq('id', transactionId)
      .single();

    if (txError || !transaction) {
      return errorResponse('Transaction introuvable', 404);
    }

    // Check user is participant
    const isParticipant = transaction.user_id === user!.id || transaction.buyer_id === user!.id;
    if (!isParticipant) {
      return errorResponse('Non autorisé - vous n\'êtes pas participant de cette transaction', 403);
    }

    // If conversation already exists, return it
    if (transaction.conversation_id) {
      return successResponse({ conversation_id: transaction.conversation_id });
    }

    // Check if buyer is assigned
    if (!transaction.buyer_id) {
      return errorResponse('Aucun acheteur assigné à cette transaction', 400);
    }

    // Create conversation
    const { data: conversation, error: convError } = await adminClient!
      .from('conversations')
      .insert({
        seller_id: transaction.user_id,
        buyer_id: transaction.buyer_id,
        transaction_id: transaction.id,
        status: 'active'
      })
      .select('id')
      .single();

    if (convError || !conversation) {
      logger.error('Error creating conversation:', convError);
      return errorResponse('Erreur lors de la création de la conversation', 500);
    }

    // Update transaction with conversation_id (best-effort)
    const { error: updateError } = await adminClient!
      .from('transactions')
      .update({ conversation_id: conversation.id })
      .eq('id', transaction.id);

    if (updateError) {
      logger.error('Error updating transaction:', updateError);
      // Do not fail - conversation is created
    }

    return successResponse({ conversation_id: conversation.id });
  } catch (error) {
    logger.error('Unexpected error:', error);
    return errorResponse('Erreur serveur', 500);
  }
};

const composedHandler = compose(
  withCors,
  withAuth,
  withValidation(ensureConversationSchema)
)(handler);

serve(composedHandler);
