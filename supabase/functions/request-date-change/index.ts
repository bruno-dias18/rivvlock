import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DateChangeRequest {
  transactionId: string;
  proposedDate: string;
  message?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get('Authorization')!;
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const { transactionId, proposedDate, message }: DateChangeRequest = await req.json();

    console.log('[REQUEST-DATE-CHANGE] Request received:', { transactionId, proposedDate, userId: user.id });

    // Verify the user is the seller of this transaction
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('user_id', user.id)
      .single();

    if (transactionError || !transaction) {
      console.error('Transaction not found or user not authorized:', transactionError);
      return new Response(JSON.stringify({ error: 'Transaction not found or unauthorized' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Check if already at max change limit (2)
    if (transaction.date_change_count >= 2) {
      return new Response(JSON.stringify({ error: 'Maximum number of date changes (2) reached' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Update transaction with proposed date change
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        proposed_service_date: proposedDate,
        date_change_status: 'pending_approval',
        date_change_requested_at: new Date().toISOString(),
        date_change_message: message || null,
        date_change_count: transaction.date_change_count + 1
      })
      .eq('id', transactionId);

    if (updateError) {
      console.error('Error updating transaction:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update transaction' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Log the activity
    const { error: logError } = await supabase
      .from('activity_logs')
      .insert({
        user_id: user.id,
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
      console.error('Error logging activity:', logError);
    }

    console.log('[REQUEST-DATE-CHANGE] Date change requested successfully');

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: any) {
    console.error('Error in request-date-change function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);