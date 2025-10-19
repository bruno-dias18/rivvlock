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
  // 1. Delete messages via conversations
  const { data: conversations } = await adminClient!
    .from('conversations')
    .select('id')
    .eq('transaction_id', transactionId);

  if (conversations && conversations.length > 0) {
    const conversationIds = conversations.map(c => c.id);
    
    // Delete message_reads for messages in these conversations
    const { data: messages } = await adminClient!
      .from('messages')
      .select('id')
      .in('conversation_id', conversationIds);
    
    if (messages && messages.length > 0) {
      await adminClient!.from('message_reads').delete().in('message_id', messages.map(m => m.id));
    }
    
    // Delete messages
    await adminClient!.from('messages').delete().in('conversation_id', conversationIds);
    
    // Delete conversation_reads
    await adminClient!.from('conversation_reads').delete().in('conversation_id', conversationIds);
    
    // Delete conversations
    await adminClient!.from('conversations').delete().in('id', conversationIds);
  }

  // 2. Delete disputes (cascade will handle dispute_proposals and dispute-related conversations)
  await adminClient!.from('disputes').delete().eq('transaction_id', transactionId);
  
  // 3. Delete invoices
  await adminClient!.from('invoices').delete().eq('transaction_id', transactionId);

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
