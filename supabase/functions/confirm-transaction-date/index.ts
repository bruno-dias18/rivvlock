import { compose, withCors, successResponse, errorResponse, getCorsHeaders } from "../_shared/middleware.ts";
import { createServiceClient } from "../_shared/supabase-utils.ts";
import { logger } from "../_shared/logger.ts";

// Safe calculation with fallbacks
const calculatePaymentDeadline = (serviceDate: string): string => {
  try {
    const date = new Date(serviceDate);
    if (isNaN(date.getTime())) throw new Error('Invalid date');
    
    const deadline = new Date(date);
    deadline.setHours(deadline.getHours() - 48);
    
    const now = new Date();
    if (deadline < now) {
      logger.warn('Deadline in past, using 24h fallback');
      return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    }
    
    return deadline.toISOString();
  } catch (error) {
    logger.error('Calculation failed, using 48h default:', error);
    return new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  }
};

const handler = compose(
  withCors
)(async (req) => {
  const { transactionId, token, proposedDate, proposedEndDate } = await req.json();
  
  // Validation
  if (!transactionId || !token || !proposedDate) {
    return errorResponse('Missing required fields', 400);
  }
  
  const supabaseAdmin = createServiceClient();
  
  // Fetch transaction with atomic verification
  const { data: transaction, error: fetchError } = await supabaseAdmin
    .from('transactions')
    .select('*')
    .eq('id', transactionId)
    .eq('shared_link_token', token)
    .single();
  
  if (fetchError || !transaction) {
    return errorResponse('Transaction not found or invalid token', 404);
  }
  
  // RACE CONDITION PROTECTION: verify exact status
  if (transaction.status !== 'pending_date_confirmation') {
    return new Response(
      JSON.stringify({ 
        error: 'Transaction already confirmed or invalid status',
        current_status: transaction.status 
      }), 
      { status: 409, headers: { ...getCorsHeaders(), 'Content-Type': 'application/json' } }
    );
  }
  
  // Calculate deadline with fallbacks
  const paymentDeadline = calculatePaymentDeadline(proposedDate);
  
  // ATOMIC UPDATE with strict WHERE condition
  const { error: updateError } = await supabaseAdmin
    .from('transactions')
    .update({
      service_date: proposedDate,
      service_end_date: proposedEndDate || proposedDate,
      payment_deadline: paymentDeadline,
      status: 'pending',
      updated_at: new Date().toISOString()
    })
    .eq('id', transactionId)
    .eq('status', 'pending_date_confirmation');
  
  if (updateError) {
    logger.error('Update error:', updateError);
    return errorResponse('Failed to confirm date', 500);
  }
  
  // System confirmation message
  await supabaseAdmin.from('transaction_messages').insert({
    transaction_id: transactionId,
    sender_id: transaction.user_id,
    message: `✅ Date confirmée : ${new Date(proposedDate).toLocaleDateString('fr-FR')}`,
    message_type: 'date_confirmed',
    metadata: { 
      confirmed_date: proposedDate,
      confirmed_end_date: proposedEndDate 
    }
  });
  
  // Log activity
  await supabaseAdmin.from('activity_logs').insert({
    user_id: transaction.user_id,
    activity_type: 'transaction_date_confirmed',
    title: 'Date de prestation confirmée',
    description: `Date confirmée pour "${transaction.title}"`,
    metadata: { transaction_id: transactionId, service_date: proposedDate }
  });
  
  logger.log(`Date confirmed for transaction ${transactionId}`);
  return successResponse({ success: true, payment_deadline: paymentDeadline });
});

Deno.serve(handler);
