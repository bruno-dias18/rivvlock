import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Get authenticated user if exists
    const authHeader = req.headers.get('Authorization');
    let authenticatedUserId: string | null = null;
    let authenticatedUser: any = null;

    if (authHeader) {
      const supabaseAuth = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      );
      
      const { data: { user } } = await supabaseAuth.auth.getUser();
      authenticatedUserId = user?.id || null;
      authenticatedUser = user;
      
      console.log('[accept-quote] Authenticated user ID:', authenticatedUserId);
    }

    const body = await req.json();
    console.log('[accept-quote] Received body:', body);
    
    const { quoteId, token } = body;

    if (!quoteId) {
      throw new Error('Missing quoteId');
    }

    let quote;

    // Path 1: Validation par token (public link OU in-app avec token)
    if (token) {
      console.log('[accept-quote] Validating with token');
      const { data, error } = await supabaseAdmin
        .from('quotes')
        .select('*')
        .eq('id', quoteId)
        .eq('secure_token', token)
        .single();
      
      if (error || !data) {
        throw new Error('Quote not found or invalid token');
      }
      quote = data;
    }
    // Path 2: Validation par authentification (in-app seulement, fallback si pas de token)
    else if (authenticatedUserId) {
      console.log('[accept-quote] Validating with auth (no token provided)');
      const { data, error } = await supabaseAdmin
        .from('quotes')
        .select('*')
        .eq('id', quoteId)
        .single();
      
      if (error || !data) {
        throw new Error('Quote not found');
      }
      
      // Vérifications de sécurité strictes
      if (data.seller_id === authenticatedUserId) {
        throw new Error('Seller cannot accept their own quote');
      }
      
      if (data.client_user_id && data.client_user_id !== authenticatedUserId) {
        throw new Error('This quote is assigned to another user');
      }
      
      if (!data.client_user_id && data.client_email) {
        // Vérifier l'email via l'auth
        if (authenticatedUser?.email !== data.client_email) {
          throw new Error('Email mismatch: this quote was sent to a different email');
        }
      }
      
      quote = data;
    } else {
      throw new Error('Authentication required: please provide a token or log in');
    }


    // Vérifier le statut du devis
    if (quote.status !== 'pending' && quote.status !== 'negotiating') {
      throw new Error('Quote is not in a valid state to be accepted');
    }

    // Attach quote to authenticated user if not already attached
    if (authenticatedUserId && !quote.client_user_id && quote.seller_id !== authenticatedUserId) {
      console.log('[accept-quote] Attaching quote to authenticated user');
      await supabaseAdmin
        .from('quotes')
        .update({ client_user_id: authenticatedUserId })
        .eq('id', quoteId);
    }

    // Vérifier si le devis a une date de service
    const hasServiceDate = quote.service_date && quote.service_date !== null;

    // Déterminer le statut de la transaction
    const transactionStatus = hasServiceDate ? 'pending' : 'pending_date_confirmation';

    // Calculer le payment_deadline si date fixe
    const paymentDeadline = hasServiceDate
      ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
      : null;

    // Créer la transaction
    const { data: transaction, error: transactionError } = await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: quote.seller_id,
        buyer_id: authenticatedUserId || null,
        client_email: quote.client_email,
        title: quote.title,
        description: quote.description,
        price: quote.total_amount,
        currency: quote.currency.toUpperCase(),
        service_date: quote.service_date,
        service_end_date: quote.service_end_date,
        status: transactionStatus,
        payment_deadline: paymentDeadline,
        seller_display_name: quote.client_name,
      })
      .select()
      .single();

    if (transactionError) throw transactionError;

    // Mettre à jour le devis
    await supabaseAdmin
      .from('quotes')
      .update({
        status: 'accepted',
        converted_transaction_id: transaction.id
      })
      .eq('id', quoteId);

    // Lier/Créer la conversation unifiée
    try {
      const { data: quoteConv } = await supabaseAdmin
        .from('quotes')
        .select('conversation_id')
        .eq('id', quoteId)
        .single();

      let conversationId = quoteConv?.conversation_id as string | null;

      if (!conversationId) {
        // Créer la conversation si elle n'existe pas (compatibilité rétro)
        const { data: conversation, error: convError } = await supabaseAdmin
          .from('conversations')
          .insert({
            seller_id: quote.seller_id,
            buyer_id: authenticatedUserId || null,
            quote_id: quoteId,
            transaction_id: transaction.id,
            status: 'active'
          })
          .select()
          .single();
        if (!convError && conversation) {
          conversationId = conversation.id;
          await supabaseAdmin.from('quotes').update({ conversation_id: conversation.id }).eq('id', quoteId);
        }
      } else {
        // Mettre à jour la conversation existante
        await supabaseAdmin
          .from('conversations')
          .update({
            buyer_id: authenticatedUserId || null,
            transaction_id: transaction.id,
          })
          .eq('id', conversationId);
      }

      // Lier la transaction à la conversation
      if (conversationId) {
        await supabaseAdmin
          .from('transactions')
          .update({ conversation_id: conversationId })
          .eq('id', transaction.id);

        // Si pas de date, envoyer message automatique dans la conversation unifiée
        if (!hasServiceDate) {
          await supabaseAdmin.from('messages').insert({
            conversation_id: conversationId,
            sender_id: quote.seller_id,
            message: '📅 Merci d\'avoir accepté le devis ! Le vendeur va vous proposer une date de prestation sous 48h.',
            message_type: 'text'
          });
        }
      }
    } catch (convLinkErr) {
      console.error('[accept-quote] Conversation link error:', convLinkErr);
      // Ne pas faire échouer l'acceptation si la conversation échoue
    }

    // Log activité
    await supabaseAdmin.from('activity_logs').insert({
      user_id: quote.seller_id,
      activity_type: 'quote_accepted',
      title: 'Devis accepté',
      description: `Le devis "${quote.title}" a été accepté`,
      metadata: { quote_id: quoteId, transaction_id: transaction.id }
    });

    return new Response(
      JSON.stringify({
        success: true,
        transaction,
        payment_link: `${req.headers.get('origin')}/payment-link/${transaction.shared_link_token}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('accept-quote error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
