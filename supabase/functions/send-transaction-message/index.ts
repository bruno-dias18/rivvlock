import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { transactionId, recipientId, message } = await req.json();

    if (!transactionId || !recipientId || !message || message.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Paramètres manquants' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate message length
    if (message.length > 1000) {
      return new Response(JSON.stringify({ error: 'Message trop long (max 1000 caractères)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user is part of the transaction
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('user_id, buyer_id, id')
      .eq('id', transactionId)
      .single();

    if (txError || !transaction) {
      return new Response(JSON.stringify({ error: 'Transaction introuvable' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isParticipant = transaction.user_id === user.id || transaction.buyer_id === user.id;
    if (!isParticipant) {
      return new Response(JSON.stringify({ error: 'Non autorisé pour cette transaction' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if dispute is escalated
    const { data: dispute } = await supabase
      .from('disputes')
      .select('escalated_at')
      .eq('transaction_id', transactionId)
      .maybeSingle();

    if (dispute?.escalated_at) {
      return new Response(JSON.stringify({ error: 'Messagerie bloquée - litige escaladé' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert message
    const { error: insertError } = await supabase
      .from('transaction_messages')
      .insert({
        transaction_id: transactionId,
        sender_id: user.id,
        recipient_id: recipientId,
        message: message.trim(),
      });

    if (insertError) {
      console.error('Error inserting message:', insertError);
      return new Response(JSON.stringify({ error: 'Erreur lors de l\'envoi du message' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log activity
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      activity_type: 'message_sent',
      title: 'Message envoyé',
      description: `Message envoyé dans la transaction ${transactionId}`,
      metadata: {
        transaction_id: transactionId,
        recipient_id: recipientId,
      },
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Erreur serveur' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
