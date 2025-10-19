import { compose, withCors, withAuth, successResponse, errorResponse } from "../_shared/middleware.ts";
import { logger } from "../_shared/logger.ts";

const handler = compose(
  withCors,
  withAuth
)(async (req, ctx) => {
  const { quoteId, token } = await req.json();

  if (!quoteId || !token) {
    return errorResponse('Paramètres manquants', 400);
  }

  logger.log(`[attach-quote] User attempting to attach quote ${quoteId}`);

  // Verify token is valid (security)
  const { data: quote, error: quoteError } = await ctx.supabaseClient!
    .from('quotes')
    .select('id, client_user_id, client_email, seller_id, title, secure_token, token_expires_at')
    .eq('id', quoteId)
    .eq('secure_token', token)
    .single();

  if (quoteError || !quote) {
    logger.error('[attach-quote] Quote not found or invalid token:', quoteError);
    return errorResponse('Devis introuvable ou token invalide', 404);
  }

  // Verify token is not expired
  if (new Date(quote.token_expires_at) < new Date()) {
    return errorResponse('Le lien de ce devis a expiré', 400);
  }

  // Verify user is not the seller
  if (quote.seller_id === ctx.user!.id) {
    logger.log('[attach-quote] User is the seller, no attachment needed');
    return successResponse({ success: true, message: 'Vous êtes le vendeur de ce devis' });
  }

  // CRITICAL SECURITY: Verify email matches
  if (ctx.user!.email !== quote.client_email) {
    logger.log(`[attach-quote] Email mismatch blocked for quote ${quoteId}`);
    
    // Log for audit
    await ctx.supabaseClient!.from('activity_logs').insert({
      user_id: ctx.user!.id,
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
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // If already attached to this user
  if (quote.client_user_id === ctx.user!.id) {
    logger.log('[attach-quote] Quote already attached to this user');
    
    // Make sure conversation is also updated
    const { data: quoteWithConv } = await ctx.supabaseClient!
      .from('quotes')
      .select('conversation_id')
      .eq('id', quoteId)
      .single();

    if (quoteWithConv?.conversation_id) {
      const { error: convError } = await ctx.adminClient!
        .from('conversations')
        .update({ buyer_id: ctx.user!.id })
        .eq('id', quoteWithConv.conversation_id)
        .is('buyer_id', null);

      if (!convError) {
        logger.log(`[attach-quote] Updated conversation ${quoteWithConv.conversation_id}`);
      }
    }
    
    return successResponse({ success: true, message: 'Devis déjà rattaché à votre compte' });
  }

  // If already attached to another user
  if (quote.client_user_id && quote.client_user_id !== ctx.user!.id) {
    logger.log('[attach-quote] Quote already attached to another user');
    return errorResponse('Ce devis est déjà rattaché à un autre compte', 400);
  }

  // Attach quote to user (use admin client to bypass RLS)
  const { error: updateError } = await ctx.adminClient!
    .from('quotes')
    .update({ client_user_id: ctx.user!.id })
    .eq('id', quoteId)
    .eq('secure_token', token) // Double verification
    .is('client_user_id', null); // Ensure not already attached

  if (updateError) {
    logger.error('[attach-quote] Update error:', updateError);
    return errorResponse('Erreur lors du rattachement', 500);
  }

  logger.log(`[attach-quote] Successfully attached quote ${quoteId}`);

  // Update conversation buyer_id if conversation exists
  const { data: quoteWithConv } = await ctx.supabaseClient!
    .from('quotes')
    .select('conversation_id')
    .eq('id', quoteId)
    .single();

  if (quoteWithConv?.conversation_id) {
    const { error: convError } = await ctx.adminClient!
      .from('conversations')
      .update({ buyer_id: ctx.user!.id })
      .eq('id', quoteWithConv.conversation_id)
      .is('buyer_id', null);

    if (convError) {
      logger.error('[attach-quote] Error updating conversation:', convError);
    } else {
      logger.log(`[attach-quote] Updated conversation ${quoteWithConv.conversation_id}`);
    }
  }

  // Log activity with email_match for audit
  await ctx.supabaseClient!.from('activity_logs').insert({
    user_id: ctx.user!.id,
    activity_type: 'quote_attached',
    title: 'Devis rattaché avec succès',
    description: `Le devis "${quote.title}" a été rattaché`,
    metadata: { quote_id: quoteId, email_match: true }
  });

  return successResponse({ 
    success: true, 
    message: 'Devis rattaché avec succès',
    quote_id: quoteId 
  });
});

Deno.serve(handler);
