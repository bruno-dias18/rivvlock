import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { logger } from "../_shared/logger.ts";
import { 
  compose, 
  withCors,
  successResponse, 
  errorResponse,
  Handler, 
  HandlerContext 
} from "../_shared/middleware.ts";

// Helper logging function
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  logger.log(`[PROCESS-EXPIRED-DEADLINES] ${step}${detailsStr}`);
};

const handler: Handler = async (req, ctx: HandlerContext) => {
  try {
    logStep("Function started");

    // Initialize Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    logStep("Supabase admin client initialized");

    // Find transactions with expired payment deadlines
    const now = new Date().toISOString();
    const { data: expiredTransactions, error: fetchError } = await supabaseAdmin
      .from('transactions')
      .select('id, title, user_id, buyer_id, payment_deadline, seller_display_name, buyer_display_name')
      .eq('status', 'pending')
      .not('payment_deadline', 'is', null)
      .lt('payment_deadline', now);

    if (fetchError) {
      logStep("Error fetching expired transactions", { error: fetchError });
      throw fetchError;
    }

    logStep("Found expired transactions", { count: expiredTransactions?.length || 0 });

    if (!expiredTransactions || expiredTransactions.length === 0) {
      logStep("No expired transactions found");
      return successResponse({ 
        message: 'No expired transactions found',
        processed: 0 
      });
    }

    // Update expired transactions status
    const transactionIds = expiredTransactions.map(t => t.id);
    const { error: updateError } = await supabaseAdmin
      .from('transactions')
      .update({ 
        status: 'expired',
        updated_at: now
      })
      .in('id', transactionIds);

    if (updateError) {
      logStep("Error updating transaction status", { error: updateError });
      throw updateError;
    }

    logStep("Updated transaction statuses to expired", { count: transactionIds.length });

    // Log activities for both sellers and buyers
    const activityLogs = [];
    
    for (const transaction of expiredTransactions) {
      // Log for seller
      activityLogs.push({
        user_id: transaction.user_id,
        activity_type: 'transaction_expired',
        title: 'Transaction expirée',
        description: `La transaction "${transaction.title}" a expiré car l'acheteur n'a pas effectué le paiement dans les délais.`,
        metadata: {
          transaction_id: transaction.id,
          reason: 'payment_deadline_expired',
          expired_at: now
        }
      });

      // Log for buyer (if exists)
      if (transaction.buyer_id) {
        activityLogs.push({
          user_id: transaction.buyer_id,
          activity_type: 'transaction_expired',
          title: 'Transaction expirée',
          description: `La transaction "${transaction.title}" a expiré car vous n'avez pas effectué le paiement dans les délais.`,
          metadata: {
            transaction_id: transaction.id,
            reason: 'payment_deadline_expired',
            expired_at: now
          }
        });
      }
    }

    // Insert activity logs
    if (activityLogs.length > 0) {
      const { error: logError } = await supabaseAdmin
        .from('activity_logs')
        .insert(activityLogs);

      if (logError) {
        logStep("Error inserting activity logs", { error: logError });
        // Don't throw here, as the main operation succeeded
      } else {
        logStep("Activity logs inserted", { count: activityLogs.length });
      }
    }

    logStep("Process completed successfully", { 
      expiredCount: expiredTransactions.length,
      activityLogsCount: activityLogs.length 
    });

    return successResponse({
      message: 'Expired transactions processed successfully',
      processed: expiredTransactions.length,
      transactions: expiredTransactions.map(t => ({
        id: t.id,
        title: t.title,
        deadline: t.payment_deadline
      }))
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in process-expired-payment-deadlines", { message: errorMessage });
    
    return errorResponse(errorMessage, 500);
  }
};

const composedHandler = compose(withCors)(handler);
serve(composedHandler);
