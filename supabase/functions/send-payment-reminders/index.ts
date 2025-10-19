import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { differenceInHours } from "npm:date-fns@3.6.0";
import { logger } from "../_shared/logger.ts";
import { 
  compose, 
  withCors,
  successResponse, 
  errorResponse,
  Handler, 
  HandlerContext 
} from "../_shared/middleware.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  logger.log(`[SEND-PAYMENT-REMINDERS] ${step}${detailsStr}`);
};

const handler: Handler = async (req, ctx: HandlerContext) => {
  try {
    logStep('Cron job started');

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Get all pending transactions with client_email and valid service_date
    const { data: pendingTransactions, error: fetchError } = await adminClient
      .from('transactions')
      .select('*')
      .eq('status', 'pending')
      .not('client_email', 'is', null)
      .not('service_date', 'is', null)
      .gt('service_date', new Date().toISOString())
      .order('service_date', { ascending: true });

    if (fetchError) {
      throw new Error(`Failed to fetch transactions: ${fetchError.message}`);
    }

    logStep('Found pending transactions', { count: pendingTransactions?.length || 0 });

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    if (pendingTransactions && pendingTransactions.length > 0) {
      for (const transaction of pendingTransactions) {
        try {
          const hoursUntilService = differenceInHours(
            new Date(transaction.service_date),
            new Date()
          );

          // Define reminder windows with 6h margin for cron tolerance
          const reminderWindows: Record<string, { min: number; max: number }> = {
            '72h': { min: 72, max: 78 },  // 72h-78h before service
            '48h': { min: 48, max: 54 },  // 48h-54h before service
            '24h': { min: 24, max: 30 },  // 24h-30h before service
            '12h': { min: 12, max: 18 }   // 12h-18h before service
          };

          // Get existing checkpoints
          const checkpoints = (transaction.reminder_checkpoints as Record<string, boolean>) || {};

          // Determine which reminder to send
          let urgencyLevel: '72h' | '48h' | '24h' | '12h' | null = null;

          for (const [level, window] of Object.entries(reminderWindows)) {
            if (!checkpoints[level] && hoursUntilService >= window.min && hoursUntilService < window.max) {
              urgencyLevel = level as '72h' | '48h' | '24h' | '12h';
              break;
            }
          }

          // Skip if not in any reminder window or already sent
          if (!urgencyLevel) {
            skipped++;
            continue;
          }

          logStep('Sending reminder', {
            transactionId: transaction.id,
            urgencyLevel,
            hoursRemaining: Math.floor(hoursUntilService)
          });

          // Send reminder email
          const { error: emailError } = await adminClient.functions.invoke('send-email', {
            body: {
              type: 'payment_reminder',
              to: transaction.client_email,
              data: {
                urgencyLevel,
                transactionTitle: transaction.title,
                amount: transaction.price,
                currency: transaction.currency,
                hoursRemaining: Math.floor(hoursUntilService),
                paymentDeadline: new Date(transaction.service_date).toLocaleString('fr-FR', {
                  dateStyle: 'long',
                  timeStyle: 'short'
                }),
                shareLink: `https://app.rivvlock.com/join/${transaction.shared_link_token}`
              }
            }
          });

          if (emailError) {
            logStep('Failed to send reminder', { transactionId: transaction.id, error: emailError });
            failed++;
            continue;
          }

          // Update checkpoints to mark this reminder as sent
          checkpoints[urgencyLevel] = true;
          await adminClient
            .from('transactions')
            .update({ reminder_checkpoints: checkpoints })
            .eq('id', transaction.id);

          logStep('Reminder sent successfully', { 
            transactionId: transaction.id, 
            urgencyLevel,
            hoursUntilService: Math.floor(hoursUntilService)
          });
          sent++;

        } catch (transactionError: any) {
          logStep('Error processing transaction', {
            transactionId: transaction.id,
            error: transactionError.message
          });
          failed++;
        }
      }
    }

    logStep('Cron job completed', { sent, skipped, failed });

    return successResponse({
      summary: {
        total: pendingTransactions?.length || 0,
        sent,
        skipped,
        failed
      }
    });

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep('ERROR in send-payment-reminders', { message: errorMessage });
    
    return errorResponse(errorMessage, 500);
  }
};

const composedHandler = compose(withCors)(handler);
serve(composedHandler);
