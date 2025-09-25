import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper logging function
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PROCESS-EXPIRED-DEADLINES] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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
      return new Response(
        JSON.stringify({ 
          message: 'No expired transactions found',
          processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
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

    // Optional: Send notifications (could be implemented later)
    // await sendExpirationNotifications(expiredTransactions);

    logStep("Process completed successfully", { 
      expiredCount: expiredTransactions.length,
      activityLogsCount: activityLogs.length 
    });

    return new Response(
      JSON.stringify({
        message: 'Expired transactions processed successfully',
        processed: expiredTransactions.length,
        transactions: expiredTransactions.map(t => ({
          id: t.id,
          title: t.title,
          deadline: t.payment_deadline
        }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in process-expired-payment-deadlines", { message: errorMessage });
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});