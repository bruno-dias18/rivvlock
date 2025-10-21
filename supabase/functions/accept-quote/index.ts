import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { 
  compose, 
  withCors, 
  successResponse, 
  errorResponse,
  Handler, 
  HandlerContext 
} from "../_shared/middleware.ts";

const handler: Handler = async (req, ctx: HandlerContext) => {
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

    // Calculer le payment_deadline
    const paymentDeadline = quote.service_date
      ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
      : null;

    // ✅ Récupérer l'email du profil authentifié (pas celui du devis)
    let finalClientEmail = quote.client_email;
    
    if (authenticatedUserId) {
      const { data: buyerProfile } = await supabaseAdmin
        .from('profiles')
        .select('first_name, last_name')
        .eq('user_id', authenticatedUserId)
        .single();
      
      // Utiliser l'email de l'utilisateur authentifié (depuis auth.users)
      if (authenticatedUser?.email) {
        finalClientEmail = authenticatedUser.email;
      }
    }

    // Créer la transaction avec l'email du profil authentifié
    const { data: transaction, error: transactionError } = await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: quote.seller_id,
        buyer_id: authenticatedUserId || null,
        client_email: finalClientEmail, // ✅ Email du profil authentifié
        title: quote.title,
        description: quote.description,
        price: quote.total_amount,
        currency: quote.currency.toUpperCase(),
        service_date: quote.service_date,
        service_end_date: quote.service_end_date,
        status: 'pending',
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

    // ✅ OPTIMISATION: Créer/lier la conversation automatiquement
    let conversationId = quote.conversation_id as string | null;

    if (!conversationId) {
      // Créer une nouvelle conversation pour ce devis accepté
      const { data: conversation, error: convError } = await supabaseAdmin
        .from('conversations')
        .insert({
          seller_id: quote.seller_id,
          buyer_id: authenticatedUserId || null,
          quote_id: quoteId,
          transaction_id: transaction.id,
          conversation_type: 'transaction',
          status: 'active'
        })
        .select('id')
        .single();

      if (convError) {
        logger.error('[accept-quote] Failed to create conversation:', convError);
      } else if (conversation) {
        conversationId = conversation.id;
        
        // Mettre à jour le devis et la transaction avec le conversation_id
        await Promise.all([
          supabaseAdmin.from('quotes').update({ conversation_id: conversationId }).eq('id', quoteId),
          supabaseAdmin.from('transactions').update({ conversation_id: conversationId }).eq('id', transaction.id)
        ]);

        // Message de bienvenue automatique
        if (!quote.service_date) {
          await supabaseAdmin.from('messages').insert({
            conversation_id: conversationId,
            sender_id: quote.seller_id,
            message: '📅 Merci d\'avoir accepté le devis ! Le vendeur va vous proposer une date de prestation sous 48h.',
            message_type: 'text'
          });
        }

        logger.log(`[accept-quote] Conversation created: ${conversationId}`);
      }
    } else {
      // La conversation existe déjà (quote créé récemment), la lier à la transaction
      await supabaseAdmin
        .from('conversations')
        .update({ 
          buyer_id: authenticatedUserId || null,
          transaction_id: transaction.id 
        })
        .eq('id', conversationId);

      await supabaseAdmin
        .from('transactions')
        .update({ conversation_id: conversationId })
        .eq('id', transaction.id);

      logger.log(`[accept-quote] Existing conversation linked: ${conversationId}`);
    }

    // Log activité
    await supabaseAdmin.from('activity_logs').insert({
      user_id: quote.seller_id,
      activity_type: 'quote_accepted',
      title: 'Devis accepté',
      description: `Le devis "${quote.title}" a été accepté`,
      metadata: { quote_id: quoteId, transaction_id: transaction.id }
    });

    return successResponse({
      transaction,
      payment_link: `${req.headers.get('origin')}/payment-link/${transaction.shared_link_token}`
    });

  } catch (error) {
    console.error('accept-quote error:', error);
    return errorResponse(error.message, 400);
  }
};

const composedHandler = compose(withCors)(handler);
serve(composedHandler);
