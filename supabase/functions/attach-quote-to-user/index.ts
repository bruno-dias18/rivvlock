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
    return successResponse({ message: 'Vous êtes le vendeur de ce devis' });
  }

  // If quote already assigned to a different user, block
  if (quote.client_user_id && quote.client_user_id !== user!.id) {
    logger.log('[attach-quote] Quote already attached to another user');
    return errorResponse('Ce devis est déjà rattaché à un autre compte', 400);
  }

  // If user is the seller, no attachment needed
  if (quote.seller_id === user!.id) {
    logger.log('[attach-quote] User is the seller, no attachment needed');
    return successResponse({ message: 'Vous êtes le vendeur de ce devis' });
  }

  // If unassigned, attach current authenticated user regardless of client_email
  if (!quote.client_user_id) {
    logger.log('[attach-quote] Attaching unassigned quote to current user');
    
    // Retrieve user email from auth
    const { data: userData, error: userError } = await adminClient!.auth.admin.getUserById(user!.id);
    if (userError || !userData?.user?.email) {
      logger.error('[attach-quote] Could not fetch user email:', userError);
      return errorResponse('Impossible de récupérer l\'email utilisateur', 500);
    }
    const userEmail = userData.user.email;
    logger.log(`[attach-quote] User email retrieved: ${userEmail}`);
    
    // Retrieve user name from profile
    const { data: profileData, error: profileError } = await supabaseClient!
      .from('profiles')
      .select('first_name, last_name')
      .eq('user_id', user!.id)
      .single();
    
    let clientName = null;
    if (profileData && !profileError) {
      clientName = [profileData.first_name, profileData.last_name].filter(Boolean).join(' ') || null;
      logger.log(`[attach-quote] User name retrieved: ${clientName}`);
    }
    
    const { error: updateError } = await adminClient!
      .from('quotes')
      .update({ 
        client_user_id: user!.id,
        client_email: userEmail,
        client_name: clientName
      })
      .eq('id', quoteId)
      .eq('secure_token', token)
      .is('client_user_id', null);

    if (updateError) {
      logger.error('[attach-quote] Update error:', updateError);
      return errorResponse('Erreur lors du rattachement', 500);
    }
  }

  // After attaching, ensure conversation is updated and return success
  if (!quote.client_user_id) {
    const { data: quoteWithConvAfter } = await supabaseClient!
      .from('quotes')
      .select('conversation_id')
      .eq('id', quoteId)
      .single();

    if (quoteWithConvAfter?.conversation_id) {
      await adminClient!
        .from('conversations')
        .update({ buyer_id: user!.id })
        .eq('id', quoteWithConvAfter.conversation_id)
        .is('buyer_id', null);
      logger.log(`[attach-quote] Updated conversation ${quoteWithConvAfter.conversation_id}`);
    }

    await supabaseClient!.from('activity_logs').insert({
      user_id: user!.id,
      activity_type: 'quote_attached',
      title: 'Devis rattaché avec succès',
      description: `Le devis "${quote.title}" a été rattaché`,
      metadata: { quote_id: quoteId, email_match: null }
    });

    return successResponse({ message: 'Devis rattaché avec succès', quote_id: quoteId });
  }

  // If already attached to this user
  if (quote.client_user_id === user!.id) {
    logger.log('[attach-quote] Quote already attached to this user');
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
    return successResponse({ message: 'Devis déjà rattaché à votre compte' });
  }
};

const composedHandler = compose(
  withCors,
  withAuth,
  withValidation(attachQuoteSchema)
)(handler);

serve(composedHandler);
