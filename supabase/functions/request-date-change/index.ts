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
  proposedDate: z.string(),
  proposedEndDate: z.string().optional(),
  paymentDeadlineHours: z.number().int().positive().optional(),
  message: z.string().optional()
});

const handler: Handler = async (_req, ctx: HandlerContext) => {
  const { user, supabaseClient, body } = ctx;
  const { transactionId, proposedDate, proposedEndDate, paymentDeadlineHours, message } = body;

  try {
    // First, check if the transaction exists at all
    const { data: transactionExists, error: existsError } = await supabaseClient!
      .from('transactions')
      .select('id, user_id, buyer_id, status, date_change_count')
      .eq('id', transactionId)
      .single();

    if (existsError) {
      logger.error('[REQUEST-DATE-CHANGE] Transaction lookup error:', existsError);
      return errorResponse('Transaction not found', 404);
    }

    // Check if the user is the seller of this transaction
    if (transactionExists.user_id !== user!.id) {
      logger.error('[REQUEST-DATE-CHANGE] User not authorized - not the seller:', {
        sellerId: transactionExists.user_id, 
        requesterId: user!.id 
      });
      return errorResponse('Not authorized - only the seller can request date changes', 403);
    }

    // Now get the full transaction data
    const { data: transaction, error: transactionError } = await supabaseClient!
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (transactionError || !transaction) {
      logger.error('Transaction not found or user not authorized:', transactionError);
      return errorResponse('Transaction not found or unauthorized', 404);
    }

    const updateData: any = {
      proposed_service_date: proposedDate,
      date_change_status: 'pending_approval',
      date_change_requested_at: new Date().toISOString(),
      date_change_message: message || null,
      date_change_count: transaction.date_change_count + 1
    };

    if (proposedEndDate) {
      updateData.proposed_service_end_date = proposedEndDate;
    }

    if (paymentDeadlineHours) {
      updateData.payment_deadline_hours = paymentDeadlineHours;
    }

    const { error: updateError } = await supabaseClient!
      .from('transactions')
      .update(updateData)
      .eq('id', transactionId);

    if (updateError) {
      logger.error('Error updating transaction:', updateError);
      return errorResponse('Failed to update transaction', 500);
    }

    // Log the activity
    const { error: logError } = await supabaseClient!
      .from('activity_logs')
      .insert({
        user_id: user!.id,
        activity_type: 'seller_validation',
        title: 'Demande de modification de date',
        description: `Nouvelle date proposée: ${new Date(proposedDate).toLocaleString('fr-FR')}${message ? `. Message: ${message}` : ''}`,
        metadata: {
          transaction_id: transactionId,
          old_service_date: transaction.service_date,
          proposed_service_date: proposedDate
        }
      });

    if (logError) {
      logger.error('Error logging activity:', logError);
    }

    return successResponse({});
  } catch (error: any) {
    logger.error('Error in request-date-change function:', error);
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
