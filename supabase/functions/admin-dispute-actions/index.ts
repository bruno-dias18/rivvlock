import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.sh/x/zod@v3.22.4/mod.ts";
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

const adminDisputeActionsSchema = z.object({
  action: z.enum(['add_message', 'update_notes', 'escalate']),
  disputeId: z.string().uuid(),
  message: z.string().optional(),
  notes: z.string().optional(),
  recipientId: z.string().uuid().optional(),
});

function logStep(step: string, data?: any) {
  logger.log(`[ADMIN-DISPUTE-ACTIONS] ${step}`, data ? JSON.stringify(data) : '');
}

const handler = async (ctx: any) => {
  const { user, adminClient, body } = ctx;
  const { action, disputeId, message, notes, recipientId } = body;

  logStep('Function started');
  logStep('User authenticated', { userId: user.id });

  // Check if user is admin
  const { data: adminCheck, error: adminError } = await adminClient
    .rpc('is_admin', { check_user_id: user.id });

  if (adminError || !adminCheck) {
    logStep('Admin check failed', { error: adminError, isAdmin: adminCheck });
    return errorResponse('Insufficient permissions', 403);
  }

  logStep('Admin privileges confirmed');
  logStep('Request parsed', { action, disputeId });

  // Get dispute details
  const { data: dispute, error: disputeError } = await adminClient
    .from('disputes')
    .select(`
      *,
      transactions (*)
    `)
    .eq('id', disputeId)
    .single();

  if (disputeError || !dispute) {
    logStep('Dispute not found', { error: disputeError });
    return errorResponse('Dispute not found', 404);
  }

  logStep('Dispute retrieved', { disputeId, status: dispute.status });

  switch (action) {
    case 'add_message':
      // Add admin message to dispute (private to a specific recipient)
      if (!recipientId || ![dispute.transactions?.user_id, dispute.transactions?.buyer_id].includes(recipientId)) {
        logStep('Invalid recipient for admin message', { recipientId });
        return errorResponse('Invalid recipientId', 400);
      }

      const targetType = recipientId === dispute.transactions?.user_id ? 'admin_to_seller' : 'admin_to_buyer';
      const conversationType = targetType === 'admin_to_seller' ? 'admin_seller_dispute' : 'admin_buyer_dispute';

      // Find the appropriate admin conversation
      const { data: conversation, error: convError } = await adminClient
        .from('conversations')
        .select('id')
        .eq('dispute_id', disputeId)
        .eq('conversation_type', conversationType)
        .single();

      if (convError || !conversation) {
        logStep('Conversation not found', { convError, conversationType });
        return errorResponse('Conversation not found for this dispute', 404);
      }

      const { error: messageError } = await adminClient
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          sender_id: user.id,
          message: message || '',
          message_type: targetType
        });

      if (messageError) {
        logStep('Failed to add message', { error: messageError });
        throw messageError;
      }

      // Update dispute status if needed
      if (dispute.status === 'escalated') {
        await adminClient
          .from('disputes')
          .update({ 
            status: 'negotiating'
          })
          .eq('id', disputeId);
      }

      logStep('Admin message added successfully');
      break;

    case 'update_notes':
      // Update or create admin notes in separate table
      if (notes) {
        // Check if notes already exist
        const { data: existingNotes } = await adminClient
          .from('admin_dispute_notes')
          .select('id')
          .eq('dispute_id', disputeId)
          .maybeSingle();

        if (existingNotes) {
          // Update existing notes
          const { error: updateError } = await adminClient
            .from('admin_dispute_notes')
            .update({ 
              notes: notes,
              updated_at: new Date().toISOString()
            })
            .eq('dispute_id', disputeId);

          if (updateError) {
            logStep('Failed to update notes', { error: updateError });
            throw updateError;
          }
        } else {
          // Create new notes
          const { error: insertError } = await adminClient
            .from('admin_dispute_notes')
            .insert({
              dispute_id: disputeId,
              admin_user_id: user.id,
              notes: notes
            });

          if (insertError) {
            logStep('Failed to create notes', { error: insertError });
            throw insertError;
          }
        }
      }

      logStep('Admin notes updated successfully');
      break;

    case 'escalate':
      // Manually escalate dispute
      const { error: escalateError } = await adminClient
        .from('disputes')
        .update({ 
          status: 'escalated',
          escalated_at: new Date().toISOString()
        })
        .eq('id', disputeId);

      if (escalateError) {
        logStep('Failed to escalate dispute', { error: escalateError });
        throw escalateError;
      }

      logStep('Dispute escalated manually');
      break;

    default:
      return errorResponse('Invalid action', 400);
  }

  // Log admin activity
  await adminClient
    .from('activity_logs')
    .insert({
      user_id: user.id,
      activity_type: 'admin_dispute_action',
      title: `Action admin sur litige #${disputeId.slice(0, 8)}`,
      description: `Action: ${action}`,
      metadata: {
        dispute_id: disputeId,
        action: action
      }
    });

  logStep('Activity logged successfully');

  return successResponse({ 
    message: 'Action completed successfully' 
  });
};

const composedHandler = compose(
  withCors,
  withAuth,
  withRateLimit({ maxRequests: 30, windowMs: 60000 }),
  withValidation(adminDisputeActionsSchema)
)(handler);

serve(composedHandler);
