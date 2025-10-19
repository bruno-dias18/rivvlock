import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

const deleteTransactionSchema = z.object({
  transactionId: z.string().uuid(),
});

const handler: Handler = async (req, ctx: HandlerContext) => {
  const { user, supabaseClient, adminClient, body } = ctx;

  logger.log('🗑️ [ADMIN-DELETE-TRANSACTION] Starting deletion process');

  // Verify user is super admin
  const { data: adminRoles } = await adminClient!
    .from('user_roles')
    .select('role')
    .eq('user_id', user!.id)
    .eq('role', 'super_admin')
    .single();

  if (!adminRoles) {
    return errorResponse('Unauthorized: Super admin access required', 403);
  }

  logger.log('✅ [ADMIN-DELETE-TRANSACTION] Super admin verified');

  const { transactionId } = body;

  // Get transaction details before deletion for logging
  const { data: transaction } = await adminClient!
    .from('transactions')
    .select('*')
    .eq('id', transactionId)
    .single();

  // Delete all related records first
  await adminClient!.from('transaction_messages').delete().eq('transaction_id', transactionId);
  await adminClient!.from('disputes').delete().eq('transaction_id', transactionId);
  await adminClient!.from('invoices').delete().eq('transaction_id', transactionId);
  await adminClient!.from('message_reads').delete().eq('message_id', transactionId);

  // Delete the transaction
  const { error: deleteError } = await adminClient!
    .from('transactions')
    .delete()
    .eq('id', transactionId);

  if (deleteError) {
    logger.error('❌ [ADMIN-DELETE-TRANSACTION] Error deleting transaction:', deleteError);
    return errorResponse(`Failed to delete transaction: ${deleteError.message}`, 500);
  }

  logger.log('✅ [ADMIN-DELETE-TRANSACTION] Transaction deleted successfully');

  // Log the deletion
  await adminClient!
    .from('activity_logs')
    .insert({
      user_id: user!.id,
      activity_type: 'admin_transaction_deleted',
      title: 'Transaction supprimée (Admin)',
      description: `Transaction "${transaction?.title}" supprimée par un administrateur`,
      metadata: {
        transaction_id: transactionId,
        deleted_transaction: transaction
      }
    });

  return successResponse({ 
    message: 'Transaction deleted successfully'
  });
};

const composedHandler = compose(
  withCors,
  withAuth,
  withValidation(deleteTransactionSchema)
)(handler);

serve(composedHandler);
