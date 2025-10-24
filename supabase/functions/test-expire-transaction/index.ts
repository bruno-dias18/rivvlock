/**
 * TEST ONLY: Force a transaction's payment_deadline to the past
 * Used by E2E tests to simulate expired transactions
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transaction_id, seller_id } = await req.json();

    if (!transaction_id || !seller_id) {
      throw new Error('Missing required fields: transaction_id, seller_id');
    }

    console.log('[TEST-EXPIRE-TRANSACTION] Start', { transaction_id, seller_id });

    // Use service role to bypass RLS for test operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify transaction belongs to seller
    const { data: transaction, error: fetchError } = await supabaseAdmin
      .from('transactions')
      .select('user_id')
      .eq('id', transaction_id)
      .single();

    if (fetchError || !transaction) {
      throw new Error(`Transaction not found: ${fetchError?.message}`);
    }

    if (transaction.user_id !== seller_id) {
      throw new Error('Transaction does not belong to seller');
    }

    // Force payment deadline to 24 hours ago
    const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();

    const { error: updateError } = await supabaseAdmin
      .from('transactions')
      .update({ payment_deadline: pastDate })
      .eq('id', transaction_id);

    if (updateError) {
      throw new Error(`Failed to expire transaction: ${updateError.message}`);
    }

    console.log('[TEST-EXPIRE-TRANSACTION] Success', { transaction_id });

    return new Response(
      JSON.stringify({ success: true, transaction_id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[TEST-EXPIRE-TRANSACTION] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
