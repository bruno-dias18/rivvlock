import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Admin client for bypassing RLS on legitimate server-side operations
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Non authentifié');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Utilisateur non authentifié');
    }

    const { quoteId, token } = await req.json();

    if (!quoteId || !token) {
      throw new Error('Paramètres manquants');
    }

    console.log(`[attach-quote] User attempting to attach quote ${quoteId}`);

    // Verify token is valid (security)
    const { data: quote, error: quoteError } = await supabaseClient
      .from('quotes')
      .select('id, client_user_id, client_email, seller_id, title, secure_token, token_expires_at')
      .eq('id', quoteId)
      .eq('secure_token', token)
      .single();

    if (quoteError || !quote) {
      console.error('[attach-quote] Quote not found or invalid token:', quoteError);
      throw new Error('Devis introuvable ou token invalide');
    }

    // Verify token is not expired
    if (new Date(quote.token_expires_at) < new Date()) {
      throw new Error('Le lien de ce devis a expiré');
    }

    // Verify user is not the seller
    if (quote.seller_id === user.id) {
      console.log('[attach-quote] User is the seller, no attachment needed');
      return new Response(
        JSON.stringify({ success: true, message: 'Vous êtes le vendeur de ce devis' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CRITICAL SECURITY: Verify email matches (Variante 1 - strict blocking)
    if (user.email !== quote.client_email) {
      console.log(`[attach-quote] Email mismatch blocked for quote ${quoteId}`);
      
      // Log for audit (sanitized in console, full data in activity_logs protected by RLS)
      await supabaseClient.from('activity_logs').insert({
        user_id: user.id,
        activity_type: 'quote_attach_blocked',
        title: 'Tentative de rattachement bloquée',
        description: 'Adresse email différente du destinataire',
        metadata: { quote_id: quoteId, email_match: false }
      });
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'email_mismatch',
          client_email: quote.client_email,
          message: `Ce devis a été envoyé à ${quote.client_email}. Veuillez vous connecter avec cette adresse.`
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If already attached to this user
    if (quote.client_user_id === user.id) {
      console.log('[attach-quote] Quote already attached to this user');
      
      // Make sure conversation is also updated
      const { data: quoteWithConv } = await supabaseClient
        .from('quotes')
        .select('conversation_id')
        .eq('id', quoteId)
        .single();

      if (quoteWithConv?.conversation_id) {
        const { error: convError } = await supabaseAdmin
          .from('conversations')
          .update({ buyer_id: user.id })
          .eq('id', quoteWithConv.conversation_id)
          .is('buyer_id', null);

        if (!convError) {
          console.log(`[attach-quote] Updated conversation ${quoteWithConv.conversation_id}`);
        }
      }
      
      return new Response(
        JSON.stringify({ success: true, message: 'Devis déjà rattaché à votre compte' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If already attached to another user
    if (quote.client_user_id && quote.client_user_id !== user.id) {
      console.log('[attach-quote] Quote already attached to another user');
      throw new Error('Ce devis est déjà rattaché à un autre compte');
    }

    // Attach quote to user (use admin client to bypass RLS)
    const { error: updateError } = await supabaseAdmin
      .from('quotes')
      .update({ client_user_id: user.id })
      .eq('id', quoteId)
      .eq('secure_token', token) // Double verification
      .is('client_user_id', null); // Ensure not already attached

    if (updateError) {
      console.error('[attach-quote] Update error:', updateError);
      throw new Error('Erreur lors du rattachement');
    }

    console.log(`[attach-quote] Successfully attached quote ${quoteId}`);

    // Update conversation buyer_id if conversation exists
    const { data: quoteWithConv } = await supabaseClient
      .from('quotes')
      .select('conversation_id')
      .eq('id', quoteId)
      .single();

    if (quoteWithConv?.conversation_id) {
      const { error: convError } = await supabaseAdmin
        .from('conversations')
        .update({ buyer_id: user.id })
        .eq('id', quoteWithConv.conversation_id)
        .is('buyer_id', null);

      if (convError) {
        console.error('[attach-quote] Error updating conversation:', convError);
        // Don't throw, quote is already attached
      } else {
        console.log(`[attach-quote] Updated conversation ${quoteWithConv.conversation_id}`);
      }
    }

    // Log activity with email_match for audit
    await supabaseClient.from('activity_logs').insert({
      user_id: user.id,
      activity_type: 'quote_attached',
      title: 'Devis rattaché avec succès',
      description: `Le devis "${quote.title}" a été rattaché`,
      metadata: { quote_id: quoteId, email_match: true }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Devis rattaché avec succès',
        quote_id: quoteId 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[attach-quote] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
