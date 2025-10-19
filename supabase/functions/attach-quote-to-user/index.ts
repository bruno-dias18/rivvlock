import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { 
  compose, 
  withCors, 
  withAuth, 
  withValidation,
  successResponse, 
  errorResponse,
  Handler,
  HandlerContext
} from "../_shared/middleware.ts";
import { logger } from "../_shared/logger.ts";

const attachQuoteSchema = z.object({
  quoteId: z.string().uuid(),
  token: z.string(),
});

const handler: Handler = async (req, ctx: HandlerContext) => {
  const { user, supabaseClient, adminClient, body } = ctx;
  const { quoteId, token } = body;

  logger.log(`[attach-quote] User attempting to attach quote ${quoteId}`);

  // Verify token is valid (security)
  const { data: quote, error: quoteError } = await supabaseClient!
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
  if (quote.seller_id === user!.id) {
    logger.log('[attach-quote] User is the seller, no attachment needed');
    return successResponse({ success: true, message: 'Vous êtes le vendeur de ce devis' });
  }

  // CRITICAL SECURITY: Verify email matches
  if (user!.email !== quote.client_email) {
    logger.log(`[attach-quote] Email mismatch blocked for quote ${quoteId}`);
    
    // Log for audit
    await supabaseClient!.from('activity_logs').insert({
      user_id: user!.id,
      activity_type: 'quote_attach_blocked',
      title: 'Tentative de rattachement bloquée',
      description: 'Adresse email différente du destinataire',
      metadata: { quote_id: quoteId, email_match: false }
    });
    
    return errorResponse(
      `Ce devis a été envoyé à ${quote.client_email}. Veuillez vous connecter avec cette adresse.`,
      403,
      { error: 'email_mismatch', client_email: quote.client_email }
    );
  }

  // If already attached to this user
  if (quote.client_user_id === user!.id) {
    logger.log('[attach-quote] Quote already attached to this user');
    
    // Make sure conversation is also updated
    const { data: quoteWithConv } = await supabaseClient!
      .from('quotes')
      .select('conversation_id')
      .eq('id', quoteId)
      .single();

    if (quoteWithConv?.conversation_id) {
      await adminClient!
        .from('conversations')
        .update({ buyer_id: user!.id })
        .eq('id', quoteWithConv.conversation_id)
        .is('buyer_id', null);
      
      logger.log(`[attach-quote] Updated conversation ${quoteWithConv.conversation_id}`);
    }
    
    return successResponse({ success: true, message: 'Devis déjà rattaché à votre compte' });
  }

  // If already attached to another user
  if (quote.client_user_id && quote.client_user_id !== user!.id) {
    logger.log('[attach-quote] Quote already attached to another user');
    return errorResponse('Ce devis est déjà rattaché à un autre compte', 400);
  }

  // Attach quote to user (use admin client to bypass RLS)
  const { error: updateError } = await adminClient!
    .from('quotes')
    .update({ client_user_id: user!.id })
    .eq('id', quoteId)
    .eq('secure_token', token)
    .is('client_user_id', null);

  if (updateError) {
    logger.error('[attach-quote] Update error:', updateError);
    return errorResponse('Erreur lors du rattachement', 500);
  }

  logger.log(`[attach-quote] Successfully attached quote ${quoteId}`);

  // Update conversation buyer_id if conversation exists
  const { data: quoteWithConv } = await supabaseClient!
    .from('quotes')
    .select('conversation_id')
    .eq('id', quoteId)
    .single();

  if (quoteWithConv?.conversation_id) {
    await adminClient!
      .from('conversations')
      .update({ buyer_id: user!.id })
      .eq('id', quoteWithConv.conversation_id)
      .is('buyer_id', null);
    
    logger.log(`[attach-quote] Updated conversation ${quoteWithConv.conversation_id}`);
  }

  // Log activity with email_match for audit
  await supabaseClient!.from('activity_logs').insert({
    user_id: user!.id,
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
};

const composedHandler = compose(
  withCors,
  withAuth,
  withValidation(attachQuoteSchema)
)(handler);

serve(composedHandler);
