import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Client with user auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const { transactionId } = await req.json();
    if (!transactionId) {
      return new Response(
        JSON.stringify({ error: 'Transaction ID requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Admin client for service operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get transaction
    const { data: transaction, error: txError } = await adminClient
      .from('transactions')
      .select('id, user_id, buyer_id, conversation_id, status')
      .eq('id', transactionId)
      .single();

    if (txError || !transaction) {
      return new Response(
        JSON.stringify({ error: 'Transaction introuvable' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check user is participant
    const isParticipant = transaction.user_id === user.id || transaction.buyer_id === user.id;
    if (!isParticipant) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé - vous n\'êtes pas participant de cette transaction' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If conversation already exists, return it
    if (transaction.conversation_id) {
      return new Response(
        JSON.stringify({ conversation_id: transaction.conversation_id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if buyer is assigned
    if (!transaction.buyer_id) {
      return new Response(
        JSON.stringify({ error: 'Aucun acheteur assigné à cette transaction' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create conversation
    const { data: conversation, error: convError } = await adminClient
      .from('conversations')
      .insert({
        seller_id: transaction.user_id,
        buyer_id: transaction.buyer_id,
        transaction_id: transaction.id,
        status: 'active'
      })
      .select('id')
      .single();

    if (convError || !conversation) {
      console.error('Error creating conversation:', convError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la création de la conversation' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update transaction with conversation_id
    const { error: updateError } = await adminClient
      .from('transactions')
      .update({ conversation_id: conversation.id })
      .eq('id', transaction.id);

    if (updateError) {
      console.error('Error updating transaction:', updateError);
      // Don't fail - conversation is created
    }

    return new Response(
      JSON.stringify({ conversation_id: conversation.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erreur serveur' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
