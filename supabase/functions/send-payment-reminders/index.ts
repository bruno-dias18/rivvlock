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
          // Calculate effective deadlines with fallback logic
          const now = new Date();
          
          // Card deadline: use payment_deadline_card or fall back to payment_deadline
          const cardDeadline = transaction.payment_deadline_card 
            ? new Date(transaction.payment_deadline_card)
            : transaction.payment_deadline 
              ? new Date(transaction.payment_deadline)
              : null;

          // Bank deadline: use payment_deadline_bank or calculate from service_date or card deadline
          let bankDeadline: Date | null = null;
          
          if (transaction.payment_deadline_bank) {
            bankDeadline = new Date(transaction.payment_deadline_bank);
          } else if (transaction.service_date) {
            // Calculate: service_date - 96 hours
            const serviceDate = new Date(transaction.service_date);
            bankDeadline = new Date(serviceDate.getTime() - 96 * 60 * 60 * 1000);
          } else if (cardDeadline) {
            // Calculate: card deadline - 72 hours
            bankDeadline = new Date(cardDeadline.getTime() - 72 * 60 * 60 * 1000);
          }

          // Calculate hours until each deadline
          const hoursUntilBankDeadline = bankDeadline ? differenceInHours(bankDeadline, now) : null;
          const hoursUntilCardDeadline = cardDeadline ? differenceInHours(cardDeadline, now) : null;

          // Define reminder windows with 6h margin for cron tolerance
          const reminderWindows: Record<string, { min: number; max: number; phase: 'bank' | 'card' }> = {
            'bank_168h': { min: 168, max: 174, phase: 'bank' },  // J-7: "Pensez au virement"
            'bank_120h': { min: 120, max: 126, phase: 'bank' },  // J-5: "Plus que 48h virement"
            'bank_96h':  { min: 96, max: 102, phase: 'bank' },   // J-4: "Dernier jour virement"
            'card_48h':  { min: 48, max: 54, phase: 'card' },    // J-2: "Virement dépassé, utilisez carte"
            'card_24h':  { min: 24, max: 30, phase: 'card' },    // J-1: "Dernier jour carte"
            'card_12h':  { min: 12, max: 18, phase: 'card' },    // J-1 -12h: "Dernières heures"
          };

          // Get existing checkpoints
          const checkpoints = (transaction.reminder_checkpoints as Record<string, boolean>) || {};

          // Determine which reminder to send
          let urgencyLevel: string | null = null;
          let paymentPhase: 'bank' | 'card' | null = null;

          for (const [level, config] of Object.entries(reminderWindows)) {
            const hoursToCheck = config.phase === 'bank' 
              ? hoursUntilBankDeadline 
              : hoursUntilCardDeadline;
              
            if (hoursToCheck && 
                !checkpoints[level] && 
                hoursToCheck >= config.min && 
                hoursToCheck < config.max) {
              urgencyLevel = level;
              paymentPhase = config.phase;
              break;
            }
          }

          // Skip if not in any reminder window or already sent
          if (!urgencyLevel || !paymentPhase) {
            skipped++;
            continue;
          }

          logStep('Sending reminder', {
            transactionId: transaction.id,
            urgencyLevel,
            paymentPhase,
            hoursUntilBank: hoursUntilBankDeadline ? Math.floor(hoursUntilBankDeadline) : null,
            hoursUntilCard: hoursUntilCardDeadline ? Math.floor(hoursUntilCardDeadline) : null,
          });

          // Send reminder email
          const { error: emailError } = await adminClient.functions.invoke('send-email', {
            body: {
              type: 'payment_reminder',
              to: transaction.client_email,
              data: {
                urgencyLevel,
                paymentPhase,
                transactionTitle: transaction.title,
                amount: transaction.price,
                currency: transaction.currency,
                bankDeadline: bankDeadline?.toISOString(),
                cardDeadline: cardDeadline?.toISOString(),
                hoursUntilBankDeadline: hoursUntilBankDeadline ? Math.floor(hoursUntilBankDeadline) : null,
                hoursUntilCardDeadline: hoursUntilCardDeadline ? Math.floor(hoursUntilCardDeadline) : null,
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
            paymentPhase,
            hoursUntilBank: hoursUntilBankDeadline ? Math.floor(hoursUntilBankDeadline) : null,
            hoursUntilCard: hoursUntilCardDeadline ? Math.floor(hoursUntilCardDeadline) : null,
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
