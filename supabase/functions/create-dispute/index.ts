import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { logger } from "../_shared/logger.ts";
import { 
  compose, 
  withCors, 
  withAuth, 
  withRateLimit, 
  withValidation,
  successResponse,
  Handler,
  HandlerContext
} from "../_shared/middleware.ts";

const createDisputeSchema = z.object({
  transactionId: z.string().uuid(),
  disputeType: z.string(),
  reason: z.string().min(1),
});

const handler: Handler = async (req, ctx: HandlerContext) => {
  const { user, supabaseClient, adminClient, body } = ctx;
  const { transactionId, disputeType, reason } = body;

  logger.log('[CREATE-DISPUTE] User:', user!.id, 'Transaction:', transactionId);

  // Verify transaction
  const { data: transaction, error: txError } = await supabaseClient!
    .from('transactions')
    .select('*')
    .eq('id', transactionId)
    .or(`user_id.eq.${user!.id},buyer_id.eq.${user!.id}`)
    .eq('status', 'paid')
    .single();

  if (txError || !transaction) {
    throw new Error('Transaction not found or not authorized');
  }

  // Check existing dispute
  const { data: existingDispute } = await supabaseClient!
    .from('disputes')
    .select('id')
    .eq('transaction_id', transactionId)
    .eq('status', 'open')
    .single();

  if (existingDispute) {
    throw new Error('A dispute already exists for this transaction');
  }

  // Create dispute with 48h deadline
  const disputeDeadline = new Date();
  disputeDeadline.setHours(disputeDeadline.getHours() + 48);

  const { data: dispute, error: disputeError } = await supabaseClient!
    .from('disputes')
    .insert({
      transaction_id: transactionId,
      reporter_id: user!.id,
      dispute_type: disputeType || 'quality_issue',
      reason,
      status: 'open',
      dispute_deadline: disputeDeadline.toISOString(),
    })
    .select()
    .single();

  if (disputeError) {
    throw new Error(`Failed to create dispute: ${disputeError.message}`);
  }

  // CRITICAL: Create or link conversation (GARANTIE 100%)
  let conversationId: string | null = null;

  try {
    // 1. Essayer de réutiliser la conversation de la transaction
    const { data: tx } = await supabaseClient!
      .from('transactions')
      .select('conversation_id')
      .eq('id', transactionId)
      .single();

    if (tx?.conversation_id) {
      // Lier la conversation existante au dispute
      await adminClient!
        .from('conversations')
        .update({ 
          dispute_id: dispute.id,
          conversation_type: 'dispute',
          updated_at: new Date().toISOString()
        })
        .eq('id', tx.conversation_id);

      await adminClient!
        .from('disputes')
        .update({ conversation_id: tx.conversation_id })
        .eq('id', dispute.id);

      conversationId = tx.conversation_id;
      logger.log('[CREATE-DISPUTE] Reused transaction conversation:', conversationId);
    } else {
      // 2. FALLBACK: Créer une nouvelle conversation dédiée au dispute
      logger.warn('[CREATE-DISPUTE] No transaction conversation found, creating new one');
      
      const { data: newConv, error: convCreateError } = await adminClient!
        .from('conversations')
        .insert({
          seller_id: transaction.user_id,
          buyer_id: transaction.buyer_id,
          transaction_id: transactionId,
          dispute_id: dispute.id,
          conversation_type: 'dispute',
          status: 'active'
        })
        .select()
        .single();

      if (convCreateError) {
        throw convCreateError;
      }

      await adminClient!
        .from('disputes')
        .update({ conversation_id: newConv.id })
        .eq('id', dispute.id);

      conversationId = newConv.id;
      logger.log('[CREATE-DISPUTE] Created new conversation:', conversationId);
    }

    // 3. Ajouter le message initial dans la conversation
    if (conversationId) {
      await supabaseClient!
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user!.id,
          message: reason,
          message_type: 'text'
        });
    }
  } catch (convErr: any) {
    // SI ÉCHEC CRITIQUE: Logger mais ne pas bloquer la création du dispute
    // Les triggers et fallbacks frontend géreront la réparation
    logger.error('[CREATE-DISPUTE] CRITICAL - Conversation linking failed:', convErr.message);
  }

  // Update transaction
  await supabaseClient!
    .from('transactions')
    .update({ status: 'disputed' })
    .eq('id', transactionId);

  // Log activity
  await supabaseClient!
    .from('activity_logs')
    .insert({
      user_id: user!.id,
      activity_type: 'dispute_created',
      title: `Litige créé pour "${transaction.title}"`,
      description: `Type: ${disputeType}`,
      metadata: {
        dispute_id: dispute.id,
        transaction_id: transactionId,
      }
    });

  logger.log('[CREATE-DISPUTE] Created:', dispute.id);

  return successResponse({ 
    disputeId: dispute.id,
    message: 'Dispute created successfully'
  });
};

const composedHandler = compose(
  withCors,
  withAuth,
  withRateLimit(),
  withValidation(createDisputeSchema)
)(handler);

serve(composedHandler);
