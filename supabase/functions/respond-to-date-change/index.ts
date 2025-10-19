import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { 
  compose, 
  withCors, 
  withAuth, 
  withRateLimit,
  withValidation,
  successResponse, 
  errorResponse,
  Handler, 
  HandlerContext 
} from "../_shared/middleware.ts";
import { logger } from "../_shared/logger.ts";

const schema = z.object({
  transactionId: z.string().uuid(),
  approved: z.boolean()
});

const handler: Handler = async (_req, ctx: HandlerContext) => {
  const { user, supabaseClient, body } = ctx;
  const { transactionId, approved } = body;

  try {
    // Verify the user is the buyer of this transaction and has a pending date change
    const { data: transaction, error: transactionError } = await supabaseClient!
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('buyer_id', user!.id)
      .eq('date_change_status', 'pending_approval')
      .single();

    if (transactionError || !transaction) {
      logger.error('Transaction not found, user not authorized, or no pending change:', transactionError);
      return errorResponse('Transaction not found, unauthorized, or no pending date change', 404);
    }

    const updateData: any = {
      date_change_status: approved ? 'none' : 'rejected',
      proposed_service_date: null,
      proposed_service_end_date: null,
      date_change_message: null
    };

    if (approved) {
      updateData.service_date = transaction.proposed_service_date;
      if (transaction.proposed_service_end_date) {
        updateData.service_end_date = transaction.proposed_service_end_date;
      }
      if (transaction.status === 'expired' || transaction.status === 'pending') {
        if (transaction.status === 'expired') updateData.status = 'pending';
        const newDeadline = new Date();
        newDeadline.setDate(newDeadline.getDate() + 1);
        newDeadline.setHours(22, 0, 0, 0);
        updateData.payment_deadline = newDeadline.toISOString();
        updateData.reminder_checkpoints = {};
      }
    }

    const { error: updateError } = await supabaseClient!
      .from('transactions')
      .update(updateData)
      .eq('id', transactionId);

    if (updateError) {
      logger.error('Error updating transaction:', updateError);
      return errorResponse('Failed to update transaction', 500);
    }

    // Log buyer activity
    await supabaseClient!.from('activity_logs').insert({
      user_id: user!.id,
      activity_type: 'buyer_validation',
      title: approved ? 'Modification de date acceptée' : 'Modification de date refusée',
      description: approved 
        ? `Nouvelle date acceptée: ${new Date(transaction.proposed_service_date).toLocaleString('fr-FR')}`
        : 'La modification de date a été refusée',
      metadata: {
        transaction_id: transactionId,
        old_service_date: transaction.service_date,
        proposed_service_date: transaction.proposed_service_date,
        approved
      }
    });

    // Log seller activity
    await supabaseClient!.from('activity_logs').insert({
      user_id: transaction.user_id,
      activity_type: 'date_change_response',
      title: approved ? 'Date de service acceptée' : 'Date de service refusée',
      description: approved 
        ? `L'acheteur a accepté la date proposée: ${new Date(transaction.proposed_service_date).toLocaleString('fr-FR')}`
        : `L'acheteur a refusé la date proposée`,
      metadata: {
        transaction_id: transactionId,
        proposed_service_date: transaction.proposed_service_date,
        approved,
        buyer_id: user!.id
      }
    });

    return successResponse({});
  } catch (error: any) {
    logger.error('Error in respond-to-date-change function:', error);
    return errorResponse(error.message ?? 'Internal error', 500);
  }
};

const composedHandler = compose(
  withCors,
  withAuth,
  withRateLimit(),
  withValidation(schema)
)(handler);

serve(composedHandler);
