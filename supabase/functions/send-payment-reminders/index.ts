import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { differenceInHours } from "npm:date-fns@3.6.0";
import { logger } from "../_shared/logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  logger.log(`[SEND-PAYMENT-REMINDERS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Cron job started');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Get all pending transactions with client_email that haven't expired yet
    const { data: pendingTransactions, error: fetchError } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('status', 'pending')
      .not('client_email', 'is', null)
      .not('payment_deadline', 'is', null)
      .gt('payment_deadline', new Date().toISOString())
      .order('payment_deadline', { ascending: true });

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
          const hoursUntilDeadline = differenceInHours(
            new Date(transaction.payment_deadline),
            new Date()
          );

          // Determine reminder urgency level
          let urgencyLevel: '72h' | '24h' | '12h' | '2h' | null = null;
          
          if (hoursUntilDeadline <= 2 && hoursUntilDeadline > 0) {
            urgencyLevel = '2h';
          } else if (hoursUntilDeadline <= 12 && hoursUntilDeadline > 2) {
            urgencyLevel = '12h';
          } else if (hoursUntilDeadline <= 24 && hoursUntilDeadline > 12) {
            urgencyLevel = '24h';
          } else if (hoursUntilDeadline <= 72 && hoursUntilDeadline > 24) {
            urgencyLevel = '72h';
          }

          // Skip if not in a reminder window
          if (!urgencyLevel) {
            skipped++;
            continue;
          }

          // Check if we already sent a reminder recently (< 6 hours ago)
          if (transaction.last_reminder_sent_at) {
            const hoursSinceLastReminder = differenceInHours(
              new Date(),
              new Date(transaction.last_reminder_sent_at)
            );
            
            if (hoursSinceLastReminder < 6) {
              skipped++;
              continue; // Too soon, skip
            }
          }

          logStep('Sending reminder', {
            transactionId: transaction.id,
            urgencyLevel,
            hoursRemaining: Math.floor(hoursUntilDeadline)
          });

          // Send reminder email
          const { error: emailError } = await supabaseAdmin.functions.invoke('send-email', {
            body: {
              type: 'payment_reminder',
              to: transaction.client_email,
              data: {
                urgencyLevel,
                transactionTitle: transaction.title,
                amount: transaction.price,
                currency: transaction.currency,
                hoursRemaining: Math.floor(hoursUntilDeadline),
                paymentDeadline: new Date(transaction.payment_deadline).toLocaleString('fr-FR', {
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

          // Update last_reminder_sent_at
          await supabaseAdmin
            .from('transactions')
            .update({ last_reminder_sent_at: new Date().toISOString() })
            .eq('id', transaction.id);

          logStep('Reminder sent successfully', { transactionId: transaction.id, urgencyLevel });
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

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total: pendingTransactions?.length || 0,
          sent,
          skipped,
          failed
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep('ERROR in send-payment-reminders', { message: errorMessage });
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
