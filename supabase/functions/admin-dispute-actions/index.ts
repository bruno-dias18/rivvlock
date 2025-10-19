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
  try {
    const { user, adminClient, supabaseClient, body } = ctx;
    const { action, disputeId, message, notes, recipientId } = body;

    logStep('Function started');
    logStep('User authenticated', { userId: user.id });

    // Check if user is admin (use secure current-user RPC)
    const { data: adminCheck, error: adminError } = await supabaseClient
      .rpc('get_current_user_admin_status');

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
          return errorResponse('Failed to add message', 500);
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
              return errorResponse('Failed to update notes', 500);
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
              return errorResponse('Failed to create notes', 500);
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
          return errorResponse('Failed to escalate dispute', 500);
        }

        logStep('Dispute escalated manually');
        break;

      default:
        return errorResponse('Invalid action', 400);
    }

    // Log admin activity
    const { error: activityError } = await adminClient
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
    if (activityError) {
      logStep('Failed to log activity', { error: activityError });
      // Don't fail the whole request for logging issues
    }

    logStep('Activity logged successfully');

    return successResponse({ 
      message: 'Action completed successfully' 
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logStep('Unhandled error', { message });
    return errorResponse(message || 'Unexpected server error', 500);
  }
};

const composedHandler = compose(
  withCors,
  withAuth,
  withRateLimit({ maxRequests: 30, windowMs: 60000 }),
  withValidation(adminDisputeActionsSchema)
)(handler);

serve(composedHandler);
