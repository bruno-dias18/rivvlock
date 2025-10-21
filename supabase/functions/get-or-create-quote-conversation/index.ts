import { compose, withCors, withAuth, successResponse, errorResponse } from "../_shared/middleware.ts";
import { logger } from "../_shared/logger.ts";

const handler = compose(
  withCors,
  withAuth
)(async (req, ctx) => {
  const body = await req.json();
  const { quoteId } = body;

  if (!quoteId) {
    return errorResponse('Missing quoteId', 400);
  }

  logger.log(`[get-or-create-quote-conversation] Processing quote ${quoteId} for user ${ctx.user!.id}`);

  // Vérifier que l'utilisateur est bien participant du devis
  const { data: quote, error: quoteError } = await ctx.supabaseClient!
    .from('quotes')
    .select('*, conversation_id')
    .eq('id', quoteId)
    .single();

  if (quoteError || !quote) {
    logger.error('[get-or-create-quote-conversation] Quote not found:', quoteError);
    return errorResponse('Quote not found', 404);
  }

  // ✅ OPTION A: "First Come First Served"
  // Vérifier que l'utilisateur est seller, client, OU que le devis est "ouvert" (pas encore de client)
  const isParticipant = 
    quote.seller_id === ctx.user!.id || 
    quote.client_user_id === ctx.user!.id ||
    !quote.client_user_id; // ← Devis "ouvert" = accessible à tous les utilisateurs authentifiés

  if (!isParticipant) {
    logger.error('[get-or-create-quote-conversation] User not authorized');
    return errorResponse('Unauthorized: you are not a participant of this quote', 403);
  }

  // ✅ AUTO-LIAISON: Si pas encore de client ET utilisateur n'est pas le vendeur
  if (!quote.client_user_id && ctx.user!.id !== quote.seller_id) {
    logger.log(`[get-or-create-quote-conversation] Auto-linking user ${ctx.user!.id} to quote ${quoteId}`);
    
    const { error: updateError } = await ctx.adminClient!
      .from('quotes')
      .update({ 
        client_user_id: ctx.user!.id,
        client_email: ctx.user!.email || quote.client_email // Préserver l'email indicatif si pas d'email utilisateur
      })
      .eq('id', quoteId);
    
    if (updateError) {
      logger.error('[get-or-create-quote-conversation] Failed to auto-link user:', updateError);
      return errorResponse('Failed to link user to quote', 500);
    }
    
    logger.log(`[get-or-create-quote-conversation] User ${ctx.user!.id} successfully auto-linked to quote ${quoteId}`);
    
    // Mettre à jour l'objet local pour refléter la liaison
    quote.client_user_id = ctx.user!.id;
    quote.client_email = ctx.user!.email || quote.client_email;
  }

  // Si conversation existe déjà, la retourner
  if (quote.conversation_id) {
    logger.log(`[get-or-create-quote-conversation] Conversation already exists: ${quote.conversation_id}`);
    return successResponse({ conversation_id: quote.conversation_id });
  }

  // Créer une nouvelle conversation
  const { data: conversation, error: convError } = await ctx.adminClient!
    .from('conversations')
    .insert({
      seller_id: quote.seller_id,
      buyer_id: quote.client_user_id || ctx.user!.id, // ← Fallback sur l'utilisateur actuel si pas encore lié (race condition)
      quote_id: quoteId,
      conversation_type: 'transaction',
      status: 'active'
    })
    .select()
    .single();

  if (convError || !conversation) {
    logger.error('[get-or-create-quote-conversation] Failed to create conversation:', convError);
    return errorResponse('Failed to create conversation', 500);
  }

  // Mettre à jour le devis avec le conversation_id
  await ctx.adminClient!
    .from('quotes')
    .update({ conversation_id: conversation.id })
    .eq('id', quoteId);

  logger.log(`[get-or-create-quote-conversation] Conversation created: ${conversation.id}`);
  return successResponse({ conversation_id: conversation.id });
});

Deno.serve(handler);
