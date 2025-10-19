import { compose, withCors, withAuth, successResponse, errorResponse } from "../_shared/middleware.ts";
import { logger } from "../_shared/logger.ts";

interface DeleteTransactionRequest {
  transactionId: string;
}

const handler = compose(
  withCors,
  withAuth
)(async (req, ctx) => {
  const { transactionId }: DeleteTransactionRequest = await req.json();

  if (!transactionId) {
    return errorResponse('Transaction ID is required', 400);
  }

  logger.log(`[DELETE-TRANSACTION] User ${ctx.user!.email} requesting to delete transaction ${transactionId}`);

  // First, verify the transaction exists and user has permission
  const { data: transaction, error: fetchError } = await ctx.adminClient!
    .from('transactions')
    .select('*')
    .eq('id', transactionId)
    .single();

  if (fetchError || !transaction) {
    logger.error('[DELETE-TRANSACTION] Transaction not found:', fetchError);
    return errorResponse('Transaction not found', 404);
  }

  // Verify user is participant (seller or buyer)
  if (transaction.user_id !== ctx.user!.id && transaction.buyer_id !== ctx.user!.id) {
    logger.error('[DELETE-TRANSACTION] User not authorized for transaction:', {
      userId: ctx.user!.id,
      sellerId: transaction.user_id,
      buyerId: transaction.buyer_id
    });
    return errorResponse('Not authorized to delete this transaction', 403);
  }

  // Verify transaction is expired OR pending with expired payment deadline
  const isExpired = transaction.status === 'expired';
  const isPaymentExpired = transaction.status === 'pending' && 
    transaction.payment_deadline && 
    new Date(transaction.payment_deadline) < new Date();

  if (!isExpired && !isPaymentExpired) {
    logger.error('[DELETE-TRANSACTION] Transaction not expired:', {
      status: transaction.status,
      paymentDeadline: transaction.payment_deadline
    });
    return errorResponse('Only expired transactions can be deleted', 400);
  }

  // Check if there's a linked dispute
  const { data: disputes } = await ctx.adminClient!
    .from('disputes')
    .select('id, status')
    .eq('transaction_id', transactionId);

  if (disputes && disputes.length > 0) {
    const activeDispute = disputes.find(d => !['resolved', 'cancelled'].includes(d.status));
    if (activeDispute) {
      logger.error('[DELETE-TRANSACTION] Active dispute exists:', activeDispute);
      return errorResponse('Cannot delete transaction with active dispute', 400);
    }
  }

  // Delete the transaction (CASCADE will handle related records)
  const { error: deleteError } = await ctx.adminClient!
    .from('transactions')
    .delete()
    .eq('id', transactionId);

  if (deleteError) {
    logger.error('[DELETE-TRANSACTION] Delete failed:', deleteError);
    return errorResponse('Failed to delete transaction', 500);
  }

  logger.log(`[DELETE-TRANSACTION] Successfully deleted transaction ${transactionId}`);
  return successResponse({ message: 'Transaction deleted successfully' });
});

Deno.serve(handler);
