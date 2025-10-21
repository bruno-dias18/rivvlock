import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { 
  compose, 
  withCors, 
  withAuth, 
  withRateLimit, 
  withValidation,
  successResponse,
  errorResponse 
} from "../_shared/middleware.ts";
import { logger } from "../_shared/logger.ts";

const joinTransactionSchema = z.object({
  transaction_id: z.string().uuid(),
  linkToken: z.string().optional(),
  token: z.string().optional(),
});

const handler = async (ctx: any) => {
  const { user, adminClient, body } = ctx;
  
  logger.log('🔍 [JOIN-TRANSACTION] Processing transaction:', body.transaction_id);
  
  const transaction_id = body.transaction_id;
  const linkToken = body.linkToken || body.token;

  // Verify transaction exists and token is valid
  const { data: transaction, error: fetchError } = await adminClient
    .from('transactions')
    .select('*')
    .eq('id', transaction_id)
    .eq('shared_link_token', linkToken)
    .single();

  if (fetchError || !transaction) {
    logger.error('❌ [JOIN-TRANSACTION] Transaction fetch error:', fetchError);
    return errorResponse('Transaction non trouvée ou token invalide', 404);
  }

  logger.log('✅ [JOIN-TRANSACTION] Transaction found:', transaction.id);

  // Check if link is expired
  const expiresAt = transaction.shared_link_expires_at || transaction.link_expires_at;
  if (expiresAt && new Date(expiresAt) < new Date()) {
    return errorResponse('Le lien d\'invitation a expiré', 400);
  }

  // Check if user is not the seller
  if (transaction.user_id === user.id) {
    return errorResponse('Vous ne pouvez pas rejoindre votre propre transaction', 400);
  }

  // Check if transaction already has a buyer
  if (transaction.buyer_id && transaction.buyer_id !== user.id) {
    return errorResponse('Cette transaction a déjà un acheteur assigné', 400);
  }

  // If user is already the buyer, return success
  if (transaction.buyer_id === user.id) {
    logger.log('✅ [JOIN-TRANSACTION] User already assigned as buyer');
    return successResponse({ 
      message: 'Utilisateur déjà assigné à cette transaction' 
    });
  }

  // Get buyer profile for display name
  const { data: buyerProfile } = await adminClient
    .from('profiles')
    .select('company_name, first_name, last_name')
    .eq('user_id', user.id)
    .single();

  const buyerDisplayName = buyerProfile?.company_name || 
    `${buyerProfile?.first_name || ''} ${buyerProfile?.last_name || ''}`.trim() || 
    'Acheteur';

  // Calculate payment deadline (24h before service date and time)
  const serviceDate = new Date(transaction.service_date);
  const paymentDeadline = new Date(serviceDate.getTime() - 24 * 60 * 60 * 1000);
  
  logger.log('🕒 [JOIN-TRANSACTION] Payment deadline calculation:', {
    serviceDate: serviceDate.toISOString(),
    paymentDeadline: paymentDeadline.toISOString(),
    timeDiff: (serviceDate.getTime() - paymentDeadline.getTime()) / (1000 * 60 * 60)
  });
  
  // Validate that payment deadline is in the future
  const now = new Date();
  if (paymentDeadline <= now) {
    return errorResponse(
      'Service trop proche : le paiement doit être possible au moins 24h avant le service.',
      400
    );
  }

  // Create conversation if it doesn't exist
  let conversationId = transaction.conversation_id;
  
  if (!conversationId) {
    const { data: newConversation, error: convError } = await adminClient
      .from('conversations')
      .insert({
        seller_id: transaction.user_id,
        buyer_id: user.id,
        transaction_id: transaction.id,
        status: 'active'
      })
      .select('id')
      .single();

    if (convError) {
      logger.error('❌ [JOIN-TRANSACTION] Conversation creation error:', convError);
    } else if (newConversation) {
      conversationId = newConversation.id;
      logger.log('✅ [JOIN-TRANSACTION] Conversation created:', conversationId);
    }
  }

  // Assign user as buyer
  const { error: updateError } = await adminClient
    .from('transactions')
    .update({ 
      buyer_id: user.id,
      buyer_display_name: buyerDisplayName,
      payment_deadline: paymentDeadline.toISOString(),
      conversation_id: conversationId,
      updated_at: new Date().toISOString()
    })
    .eq('id', transaction_id);

  if (updateError) {
    logger.error('❌ [JOIN-TRANSACTION] Update error:', updateError);
    return errorResponse('Erreur lors de l\'assignation à la transaction', 500);
  }

  logger.log('✅ [JOIN-TRANSACTION] Successfully assigned buyer:', user.id);

  // Log activity for both buyer and seller
  try {
    await adminClient.from('activity_logs').insert([
      {
        user_id: user.id,
        activity_type: 'transaction_joined',
        title: 'Transaction rejointe',
        description: `Vous avez rejoint la transaction "${transaction.title}"`
      },
      {
        user_id: transaction.user_id,
        activity_type: 'buyer_joined_transaction',
        title: `${buyerDisplayName} a rejoint votre transaction`,
        description: `Un client a rejoint votre transaction "${transaction.title}"`,
        metadata: {
          transaction_id: transaction.id,
          buyer_id: user.id,
          buyer_name: buyerDisplayName
        }
      }
    ]);
  } catch (logError) {
    logger.error('❌ [JOIN-TRANSACTION] Error logging activity:', logError);
  }

  return successResponse({ 
    message: 'Transaction rejointe avec succès',
    transaction_id: transaction_id,
    buyer_id: user.id
  });
};

const composedHandler = compose(
  withCors,
  withAuth,
  withRateLimit({ maxRequests: 10, windowMs: 60000 }),
  withValidation(joinTransactionSchema)
)(handler);

Deno.serve(composedHandler);
