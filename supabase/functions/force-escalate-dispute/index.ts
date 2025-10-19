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

const forceEscalateSchema = z.object({
  disputeId: z.string().uuid(),
});

// Production-visible step logger
const logStep = (step: string, details?: Record<string, unknown>) => {
  const ts = new Date().toISOString();
  const d = details ? ` | ${JSON.stringify(details)}` : '';
  console.log(`[FORCE-ESCALATE ${ts}] ${step}${d}`);
};

const handler = async (ctx: any) => {
  try {
    const { user, supabaseClient, adminClient, body } = ctx;
    const { disputeId } = body;

    // Verify user is admin
    const { data: isAdmin } = await supabaseClient.rpc('is_admin', {
      check_user_id: user.id
    });

    if (!isAdmin) {
      return errorResponse("Only admins can force escalate disputes", 403);
    }

    logStep('INPUT_VALIDATED_START', { disputeId });
    logger.log("Force escalating dispute:", disputeId, "by admin:", user.id);

    // Get dispute with transaction
    const { data: dispute, error: disputeError } = await adminClient
      .from("disputes")
      .select(`
        *,
        transactions (*)
      `)
      .eq("id", disputeId)
      .single();

    if (disputeError || !dispute) {
      logger.error("Error fetching dispute:", disputeError);
      return errorResponse("Dispute not found", 404);
    }

    logStep('DISPUTE_LOADED', { disputeId, transaction_id: dispute.transaction_id, status: dispute.status });

    // If already escalated, return idempotent success
    if (dispute.status === 'escalated') {
      return successResponse({ 
        message: "Déjà escaladé",
      });
    }

    // Ensure we have the transaction
    let transaction = (dispute as any).transactions;
    if (!transaction && dispute.transaction_id) {
      const { data: tx, error: txError } = await adminClient
        .from('transactions')
        .select('*')
        .eq('id', dispute.transaction_id)
        .maybeSingle();
      if (txError) {
        logger.error("Error fetching transaction fallback:", txError);
      }
      transaction = tx ?? null;
    }

    if (!transaction) {
      // Fallback: escalate status even if transaction embed failed
      logStep('TRANSACTION_MISSING_ESCALATE_ONLY', { disputeId });
      const { error: updateError } = await adminClient
        .from("disputes")
        .update({
          status: 'escalated',
          escalated_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", disputeId);

      if (updateError) {
        logger.error("Error updating dispute (no tx):", updateError);
        return errorResponse("Failed to escalate dispute", 500);
      }

      return successResponse({ 
        message: "Litige escaladé (contexte transaction indisponible)",
      });
    }

    logStep('TRANSACTION_LOADED', { transaction_id: transaction.id });

    // Update dispute to escalated status
    const { error: updateError } = await adminClient
      .from("disputes")
      .update({
        status: 'escalated',
        escalated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", disputeId);

    if (updateError) {
      logger.error("Error updating dispute:", updateError);
      return errorResponse("Failed to escalate dispute", 500);
    }

    logger.log("✅ Dispute escaladé (mise à jour statut OK)");

    // Create escalated conversations (idempotent via RPC)
    logStep('CREATING_ESCALATED_CONVERSATIONS', { disputeId, adminId: user.id });
    
    const { data: conversations, error: convError } = await adminClient
      .rpc('create_escalated_dispute_conversations', {
        p_dispute_id: disputeId,
        p_admin_id: user.id
      });

    if (convError) {
      logger.error("Error creating escalated conversations:", convError);
      // Continue anyway - conversations might already exist
    } else {
      logger.log("✅ Escalated conversations ensured:", conversations);
      logStep('CONVERSATIONS_CREATED_OR_VERIFIED', conversations);
    }

    // Insert system message in main conversation
    if (dispute.conversation_id) {
      await adminClient
        .from('messages')
        .insert({
          conversation_id: dispute.conversation_id,
          sender_id: user.id,
          message: '⚠️ Ce litige a été escaladé à un administrateur pour résolution',
          message_type: 'system'
        });
    }

    // Log activities for both parties
    await adminClient.from('activity_logs').insert([
      {
        user_id: transaction.user_id,
        activity_type: 'dispute_escalated',
        title: `Litige escaladé - "${transaction.title}"`,
        description: 'Un administrateur va maintenant gérer ce litige',
        metadata: {
          dispute_id: disputeId,
          transaction_id: transaction.id,
          admin_id: user.id
        }
      },
      {
        user_id: transaction.buyer_id,
        activity_type: 'dispute_escalated',
        title: `Litige escaladé - "${transaction.title}"`,
        description: 'Un administrateur va maintenant gérer ce litige',
        metadata: {
          dispute_id: disputeId,
          transaction_id: transaction.id,
          admin_id: user.id
        }
      }
    ]);

    // Send notifications
    try {
      await adminClient!.functions.invoke('send-notifications', {
        body: {
          type: 'dispute_escalated',
          transactionId: transaction.id,
          message: `Le litige concernant "${transaction.title}" a été escaladé à un administrateur`,
          recipients: [transaction.user_id, transaction.buyer_id]
        }
      });
    } catch (notificationError) {
      logger.error("Error sending notification:", notificationError);
    }

    return successResponse({ 
      message: "Litige escaladé avec succès",
      conversations
    });

  } catch (error) {
    logger.error("Error in force-escalate-dispute:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResponse(errorMessage, 500);
  }
};

const composedHandler = compose(
  withCors,
  withAuth,
  withRateLimit({ maxRequests: 10, windowMs: 60000 }),
  withValidation(forceEscalateSchema)
)(handler);

serve(composedHandler);
