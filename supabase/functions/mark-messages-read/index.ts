import { compose, withCors, withAuth, successResponse, errorResponse } from "../_shared/middleware.ts";
import { logger } from "../_shared/logger.ts";

const handler = compose(
  withCors,
  withAuth
)(async (req, ctx) => {
  const { transactionId } = await req.json();

  if (!transactionId) {
    return errorResponse('Transaction ID required', 400);
  }

  logger.log(`Marking messages as read for transaction ${transactionId} by user ${ctx.user!.id}`);

  // Verify user is participant in transaction
  const { data: transaction, error: txError } = await ctx.supabaseClient!
    .from('transactions')
    .select('user_id, buyer_id')
    .eq('id', transactionId)
    .single();

  if (txError || !transaction) {
    logger.error('Transaction not found:', txError);
    return errorResponse('Transaction not found', 404);
  }

  if (transaction.user_id !== ctx.user!.id && transaction.buyer_id !== ctx.user!.id) {
    logger.error('User not authorized for this transaction');
    return errorResponse('Not authorized', 403);
  }

  // Get all messages in this transaction not sent by user
  const { data: messages, error: msgError } = await ctx.supabaseClient!
    .from('transaction_messages')
    .select('id')
    .eq('transaction_id', transactionId)
    .neq('sender_id', ctx.user!.id);

  if (msgError) {
    logger.error('Error fetching messages:', msgError);
    return errorResponse('Failed to fetch messages', 500);
  }

  if (!messages || messages.length === 0) {
    return successResponse({ success: true, marked: 0 });
  }

  // Mark all messages as read
  const { error: updateError } = await ctx.supabaseClient!
    .from('transaction_messages')
    .update({ read: true })
    .in('id', messages.map(m => m.id));

  if (updateError) {
    logger.error('Error marking messages as read:', updateError);
    return errorResponse('Failed to mark messages as read', 500);
  }

  logger.log(`Marked ${messages.length} messages as read for transaction ${transactionId}`);
  return successResponse({ success: true, marked: messages.length });
});

Deno.serve(handler);
