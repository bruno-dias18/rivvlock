import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DateChangeResponse {
  transactionId: string;
  approved: boolean;
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
        global: {
          headers: {
            Authorization: req.headers.get('Authorization') ?? '',
          },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const { transactionId, approved }: DateChangeResponse = await req.json();

    console.log('[RESPOND-DATE-CHANGE] Response received:', { transactionId, approved, userId: user.id });

    // Verify the user is the buyer of this transaction and has a pending date change
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('buyer_id', user.id)
      .eq('date_change_status', 'pending_approval')
      .single();

    if (transactionError || !transaction) {
      console.error('Transaction not found, user not authorized, or no pending change:', transactionError);
      return new Response(JSON.stringify({ error: 'Transaction not found, unauthorized, or no pending date change' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    let updateData: any = {
      date_change_status: approved ? 'approved' : 'rejected'
    };

    // If approved, update the service_date to the proposed date
    if (approved) {
      updateData.service_date = transaction.proposed_service_date;
      
      // Also update service_end_date if proposed
      if (transaction.proposed_service_end_date) {
        updateData.service_end_date = transaction.proposed_service_end_date;
      }
      
      // If transaction was expired, reactivate it with new payment deadline
      if (transaction.status === 'expired') {
        updateData.status = 'pending';
        // Set new payment deadline to 22:00 tomorrow to give enough time
        const newDeadline = new Date();
        newDeadline.setDate(newDeadline.getDate() + 1); // Tomorrow
        newDeadline.setHours(22, 0, 0, 0); // 22:00 sharp
        updateData.payment_deadline = newDeadline.toISOString();
      }
    }

    // Update transaction
    const { error: updateError } = await supabase
      .from('transactions')
      .update(updateData)
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

    if (logError) {
      console.error('Error logging activity:', logError);
    }

    console.log(`[RESPOND-DATE-CHANGE] Date change ${approved ? 'approved' : 'rejected'} successfully`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: any) {
    console.error('Error in respond-to-date-change function:', error);
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