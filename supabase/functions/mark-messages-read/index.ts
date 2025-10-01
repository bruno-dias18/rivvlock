import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
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
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { transactionId } = await req.json();

    if (!transactionId) {
      return new Response(
        JSON.stringify({ error: 'Transaction ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Marking messages as read for transaction ${transactionId} by user ${user.id}`);

    // Verify user is participant in transaction
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('user_id, buyer_id')
      .eq('id', transactionId)
      .single();

    if (txError || !transaction) {
      console.error('Transaction not found:', txError);
      return new Response(
        JSON.stringify({ error: 'Transaction not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (transaction.user_id !== user.id && transaction.buyer_id !== user.id) {
      console.error('User not authorized for this transaction');
      return new Response(
        JSON.stringify({ error: 'Not authorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all messages in this transaction not sent by user
    const { data: messages, error: msgError } = await supabase
      .from('transaction_messages')
      .select('id')
      .eq('transaction_id', transactionId)
      .neq('sender_id', user.id);

    if (msgError) {
      console.error('Error fetching messages:', msgError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch messages' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!messages || messages.length === 0) {
      console.log('No messages to mark as read');
      return new Response(
        JSON.stringify({ success: true, markedCount: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create read records for all messages
    const readRecords = messages.map(msg => ({
      message_id: msg.id,
      user_id: user.id,
    }));

    const { error: insertError } = await supabase
      .from('message_reads')
      .upsert(readRecords, { onConflict: 'message_id,user_id', ignoreDuplicates: true });

    if (insertError) {
      console.error('Error marking messages as read:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to mark messages as read' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully marked ${messages.length} messages as read`);

    return new Response(
      JSON.stringify({ success: true, markedCount: messages.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
