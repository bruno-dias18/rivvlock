import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logger } from "../_shared/logger.ts";
import { 
  compose, 
  withCors,
  successResponse, 
  errorResponse,
  Handler, 
  HandlerContext 
} from "../_shared/middleware.ts";

const handler: Handler = async (req, ctx: HandlerContext) => {
  try {
    logger.log('[PROCESS-DISPUTE-DEADLINES] Function started');

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Admin client (same service role) for clarity
    const adminClient = supabaseClient;

    // Find disputes that have passed their 48h deadline and are still in negotiation
    const { data: expiredDisputes, error: fetchError } = await supabaseClient
      .from('disputes')
      .select(`
        *,
        transactions (
          id,
          title,
          user_id,
          buyer_id,
          profiles!user_id (first_name, last_name),
          buyer_profiles:profiles!buyer_id (first_name, last_name)
        )
      `)
      .in('status', ['open', 'negotiating', 'responded'])
      .lt('dispute_deadline', new Date().toISOString())
      .is('escalated_at', null);

    if (fetchError) {
      logger.error('[PROCESS-DISPUTE-DEADLINES] Error fetching expired disputes:', fetchError);
      throw fetchError;
    }

    logger.log(`[PROCESS-DISPUTE-DEADLINES] Found ${expiredDisputes?.length || 0} expired disputes`);

    if (!expiredDisputes || expiredDisputes.length === 0) {
      return successResponse({ 
        message: 'No expired disputes found',
        processed: 0 
      });
    }

    const results = [];

    // Process each expired dispute
    for (const dispute of expiredDisputes) {
      try {
        logger.log(`[PROCESS-DISPUTE-DEADLINES] Processing dispute ${dispute.id}`);

        // Update dispute status to escalated
        const { error: updateError } = await supabaseClient
          .from('disputes')
          .update({
            status: 'escalated',
            escalated_at: new Date().toISOString(),
          })
          .eq('id', dispute.id);

        if (updateError) {
          logger.error(`[PROCESS-DISPUTE-DEADLINES] Error updating dispute ${dispute.id}:`, updateError);
          results.push({
            disputeId: dispute.id,
            status: 'error',
            error: updateError.message,
          });
          continue;
        }

        // Create admin conversations for both parties
        let adminId: string | null = null;
        const { data: adminRecord } = await adminClient
          .from('user_roles')
          .select('user_id')
          .eq('role', 'admin')
          .limit(1)
          .maybeSingle();
        adminId = adminRecord?.user_id ?? null;

        if (adminId) {
          const { error: convError } = await adminClient.rpc('create_escalated_dispute_conversations', {
            p_dispute_id: dispute.id,
            p_admin_id: adminId
          });
          if (convError) {
            logger.error(`[PROCESS-DISPUTE-DEADLINES] Error creating escalated conversations for dispute ${dispute.id}:`, convError);
          }
        }

        // Insert a system message in main conversation if present
        if (dispute.conversation_id) {
          const { error: msgError } = await adminClient
            .from('messages')
            .insert({
              conversation_id: dispute.conversation_id,
              sender_id: adminId,
              message: '⚠️ Ce litige a été escaladé automatiquement au support après expiration du délai de 48h',
              message_type: 'system'
            });
          if (msgError) {
            logger.error(`[PROCESS-DISPUTE-DEADLINES] Error inserting system message for dispute ${dispute.id}:`, msgError);
          }
        }

        // Log the escalation in activity logs for both parties
        const { error: logError } = await supabaseClient
          .from('activity_logs')
          .insert([
            {
              user_id: dispute.transactions?.user_id,
              title: 'Litige escaladé automatiquement',
              description: `Le litige pour "${dispute.transactions?.title}" a été escaladé au support après 48h sans résolution amiable`,
              activity_type: 'dispute_escalated',
              metadata: {
                dispute_id: dispute.id,
                transaction_id: dispute.transaction_id,
                escalation_reason: 'deadline_expired',
              },
            },
            {
              user_id: dispute.transactions?.buyer_id,
              title: 'Litige escaladé automatiquement',
              description: `Le litige pour "${dispute.transactions?.title}" a été escaladé au support après 48h sans résolution amiable`,
              activity_type: 'dispute_escalated',
              metadata: {
                dispute_id: dispute.id,
                transaction_id: dispute.transaction_id,
                escalation_reason: 'deadline_expired',
              },
            },
          ].filter((x) => x.user_id));

        if (logError) {
          logger.error(`[PROCESS-DISPUTE-DEADLINES] Error logging escalation for dispute ${dispute.id}:`, logError);
        }

        // Notify all parties about the escalation
        const notificationPayload = {
          type: 'dispute_escalated',
          transactionId: dispute.transaction_id,
          message: `Le litige concernant "${dispute.transactions?.title}" a été escaladé au support client pour arbitrage après 48h sans résolution amiable.`,
          recipients: [
            dispute.reporter_id,
            dispute.transactions?.user_id,
            dispute.transactions?.buyer_id,
          ].filter(Boolean),
          metadata: {
            dispute_id: dispute.id,
            escalated_at: new Date().toISOString(),
          },
        };

        // Send notification via edge function
        const { error: notificationError } = await supabaseClient.functions.invoke(
          'send-notifications',
          { body: notificationPayload }
        );

        if (notificationError) {
          logger.error(`[PROCESS-DISPUTE-DEADLINES] Error sending escalation notification for dispute ${dispute.id}:`, notificationError);
        }

        results.push({
          disputeId: dispute.id,
          transactionId: dispute.transaction_id,
          status: 'escalated',
          escalatedAt: new Date().toISOString(),
        });

        logger.log(`[PROCESS-DISPUTE-DEADLINES] Successfully escalated dispute ${dispute.id}`);

      } catch (error) {
        logger.error(`[PROCESS-DISPUTE-DEADLINES] Error processing dispute ${dispute.id}:`, error);
          results.push({
            disputeId: dispute.id,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
      }
    }

    logger.log(`[PROCESS-DISPUTE-DEADLINES] Processing completed - ${results.length} disputes processed`);

    return successResponse({
      message: 'Dispute deadlines processed successfully',
      processed: results.length,
      results,
    });

  } catch (error) {
    logger.error('[PROCESS-DISPUTE-DEADLINES] Function error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      500
    );
  }
};

const composedHandler = compose(withCors)(handler);
serve(composedHandler);
