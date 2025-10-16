import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fonction de calcul SAFE avec fallbacks
const calculatePaymentDeadline = (serviceDate: string): string => {
  try {
    const date = new Date(serviceDate);
    if (isNaN(date.getTime())) throw new Error('Invalid date');
    
    const deadline = new Date(date);
    deadline.setHours(deadline.getHours() - 48);
    
    const now = new Date();
    if (deadline < now) {
      console.warn('Deadline in past, using 24h fallback');
      return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    }
    
    return deadline.toISOString();
  } catch (error) {
    console.error('Calculation failed, using 48h default:', error);
    return new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transactionId, token, proposedDate, proposedEndDate } = await req.json();
    
    // Validation entrées
    if (!transactionId || !token || !proposedDate) {
      throw new Error('Missing required fields');
    }
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    
    // Fetch transaction avec vérification atomique
    const { data: transaction, error: fetchError } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('shared_link_token', token)
      .single();
    
    if (fetchError || !transaction) {
      throw new Error('Transaction not found or invalid token');
    }
    
    // PROTECTION RACE CONDITION : vérifier statut exact
    if (transaction.status !== 'pending_date_confirmation') {
      return new Response(
        JSON.stringify({ 
          error: 'Transaction already confirmed or invalid status',
          current_status: transaction.status 
        }), 
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Calcul deadline avec fallbacks
    const paymentDeadline = calculatePaymentDeadline(proposedDate);
    
    // UPDATE ATOMIQUE avec condition WHERE stricte
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
    
    if (updateError) throw updateError;
    
    // Message système de confirmation
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
    
    // Log activité
    await supabaseAdmin.from('activity_logs').insert({
      user_id: transaction.user_id,
      activity_type: 'transaction_date_confirmed',
      title: 'Date de prestation confirmée',
      description: `Date confirmée pour "${transaction.title}"`,
      metadata: { transaction_id: transactionId, service_date: proposedDate }
    });
    
    return new Response(
      JSON.stringify({ success: true, payment_deadline: paymentDeadline }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('confirm-transaction-date error:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
