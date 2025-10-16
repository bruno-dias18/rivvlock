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

    console.log(`[attach-quote] User ${user.id} attempting to attach quote ${quoteId}`);

    // Verify token is valid (security)
    const { data: quote, error: quoteError } = await supabaseClient
      .from('quotes')
      .select('id, client_user_id, seller_id, title, secure_token, token_expires_at')
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

    // If already attached to this user
    if (quote.client_user_id === user.id) {
      console.log('[attach-quote] Quote already attached to this user');
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

    // Attach quote to user
    const { error: updateError } = await supabaseClient
      .from('quotes')
      .update({ client_user_id: user.id })
      .eq('id', quoteId)
      .eq('secure_token', token) // Double verification
      .is('client_user_id', null); // Ensure not already attached

    if (updateError) {
      console.error('[attach-quote] Update error:', updateError);
      throw new Error('Erreur lors du rattachement');
    }

    console.log(`[attach-quote] Successfully attached quote ${quoteId} to user ${user.id}`);

    // Log activity
    await supabaseClient.from('activity_logs').insert({
      user_id: user.id,
      activity_type: 'quote_attached',
      title: 'Devis rattaché',
      description: `Le devis "${quote.title}" a été rattaché à votre compte`,
      metadata: { quote_id: quoteId }
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
