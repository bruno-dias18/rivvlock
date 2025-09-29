import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[PROCESS-DISPUTE-DEADLINES] Function started');

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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
      console.error('[PROCESS-DISPUTE-DEADLINES] Error fetching expired disputes:', fetchError);
      throw fetchError;
    }

    console.log(`[PROCESS-DISPUTE-DEADLINES] Found ${expiredDisputes?.length || 0} expired disputes`);

    if (!expiredDisputes || expiredDisputes.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No expired disputes found',
          processed: 0 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    const results = [];

    // Process each expired dispute
    for (const dispute of expiredDisputes) {
      try {
        console.log(`[PROCESS-DISPUTE-DEADLINES] Processing dispute ${dispute.id}`);

        // Update dispute status to escalated
        const { error: updateError } = await supabaseClient
          .from('disputes')
          .update({
            status: 'escalated',
            escalated_at: new Date().toISOString(),
          })
          .eq('id', dispute.id);

        if (updateError) {
          console.error(`[PROCESS-DISPUTE-DEADLINES] Error updating dispute ${dispute.id}:`, updateError);
          results.push({
            disputeId: dispute.id,
            status: 'error',
            error: updateError.message,
          });
          continue;
        }

        // Log the escalation in activity logs
        const { error: logError } = await supabaseClient
          .from('activity_logs')
          .insert({
            user_id: dispute.reporter_id,
            title: 'Litige escaladé automatiquement',
            description: `Le litige pour "${dispute.transactions?.title}" a été escaladé au support après 48h sans résolution amiable`,
            activity_type: 'dispute_escalated',
            metadata: {
              dispute_id: dispute.id,
              transaction_id: dispute.transaction_id,
              escalation_reason: 'deadline_expired',
            },
          });

        if (logError) {
          console.error(`[PROCESS-DISPUTE-DEADLINES] Error logging escalation for dispute ${dispute.id}:`, logError);
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
          console.error(`[PROCESS-DISPUTE-DEADLINES] Error sending escalation notification for dispute ${dispute.id}:`, notificationError);
        }

        results.push({
          disputeId: dispute.id,
          transactionId: dispute.transaction_id,
          status: 'escalated',
          escalatedAt: new Date().toISOString(),
        });

        console.log(`[PROCESS-DISPUTE-DEADLINES] Successfully escalated dispute ${dispute.id}`);

      } catch (error) {
        console.error(`[PROCESS-DISPUTE-DEADLINES] Error processing dispute ${dispute.id}:`, error);
          results.push({
            disputeId: dispute.id,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
      }
    }

    console.log(`[PROCESS-DISPUTE-DEADLINES] Processing completed - ${results.length} disputes processed`);

    return new Response(
      JSON.stringify({
        message: 'Dispute deadlines processed successfully',
        processed: results.length,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[PROCESS-DISPUTE-DEADLINES] Function error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});