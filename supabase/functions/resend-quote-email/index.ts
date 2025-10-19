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

const resendQuoteSchema = z.object({
  quote_id: z.string().uuid(),
});

const handler: Handler = async (req, ctx: HandlerContext) => {
  const { user, adminClient, body } = ctx;

  logger.log('[RESEND-QUOTE-EMAIL] Fetching quote:', body.quote_id);

  // Récupérer le devis
  const { data: quote, error: quoteError } = await adminClient!
    .from('quotes')
    .select('*')
    .eq('id', body.quote_id)
    .single();

  if (quoteError || !quote) {
    return errorResponse('Quote not found', 404);
  }

  // Vérifier que l'utilisateur est bien le vendeur
  if (quote.seller_id !== user!.id) {
    return errorResponse('Unauthorized: You are not the seller of this quote', 403);
  }

  logger.log('[RESEND-QUOTE-EMAIL] Quote found, seller verified');

  // Récupérer le profil du vendeur
  const { data: sellerProfile } = await adminClient!
    .from('profiles')
    .select('first_name, last_name, company_name')
    .eq('user_id', user!.id)
    .single();

  const sellerName = sellerProfile?.company_name || 
                    `${sellerProfile?.first_name || ''} ${sellerProfile?.last_name || ''}`.trim() ||
                    'Le vendeur';

  // Générer le lien du devis
  const origin = req.headers.get('origin') || 'https://app.rivvlock.com';
  const quoteLink = `${origin}/quote/${quote.id}/${quote.secure_token}`;

  logger.log('[RESEND-QUOTE-EMAIL] Sending email to:', quote.client_email);

  // Envoyer l'email via send-email function
  const { error: emailError } = await adminClient!.functions.invoke('send-email', {
    body: {
      type: 'quote_created',
      to: quote.client_email,
      data: {
        clientName: quote.client_name || quote.client_email,
        sellerName,
        quoteTitle: quote.title,
        quoteLink,
        totalAmount: quote.total_amount.toFixed(2),
        currency: quote.currency,
        validUntil: new Date(quote.valid_until).toLocaleDateString('fr-FR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      }
    }
  });

  if (emailError) {
    logger.error('[RESEND-QUOTE-EMAIL] Email error:', emailError);
    return errorResponse('Failed to send email', 500);
  }

  // Logger l'activité
  await adminClient!.from('activity_logs').insert({
    user_id: user!.id,
    activity_type: 'quote_email_resent',
    title: 'Email de devis renvoyé',
    description: `Email du devis "${quote.title}" renvoyé à ${quote.client_email}`,
    metadata: { quote_id: quote.id }
  });

  logger.log('[RESEND-QUOTE-EMAIL] Email sent successfully');

  return successResponse({ 
    message: 'Email sent successfully',
    client_email: quote.client_email
  });
};

const composedHandler = compose(
  withCors,
  withAuth,
  withValidation(resendQuoteSchema)
)(handler);

serve(composedHandler);
