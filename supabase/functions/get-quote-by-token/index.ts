import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  compose, 
  withCors, 
  withValidation, 
  successResponse,
  errorResponse,
  Handler,
  HandlerContext 
} from "../_shared/middleware.ts";
import { createServiceClient } from "../_shared/supabase-utils.ts";
import { logger } from "../_shared/logger.ts";

const getQuoteSchema = z.object({
  quote_id: z.string().uuid(),
  secure_token: z.string(),
});

const handler: Handler = async (req, ctx: HandlerContext) => {
  const { body } = ctx;
  const supabaseAdmin = createServiceClient();

  // Récupérer l'utilisateur authentifié si présent
  const authHeader = req.headers.get('Authorization');
  let authenticatedUserId: string | null = null;

  if (authHeader) {
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabaseAuth.auth.getUser();
    authenticatedUserId = user?.id || null;
  }

  logger.log('[GET-QUOTE-BY-TOKEN] Fetching quote:', body.quote_id);

  // ✅ OPTIMISATION: Récupérer quote + seller en 1 seule requête avec join
  const { data: quote, error: quoteError } = await supabaseAdmin
    .from('quotes')
    .select(`
      *,
      seller:profiles!quotes_seller_id_fkey(first_name, last_name, company_name)
    `)
    .eq('id', body.quote_id)
    .eq('secure_token', body.secure_token)
    .single();

  if (quoteError || !quote) {
    logger.error('[GET-QUOTE-BY-TOKEN] Quote not found or invalid token');
    return errorResponse('Devis non trouvé ou lien invalide', 404);
  }

  // Vérifier si le token a expiré
  const tokenExpiresAt = new Date(quote.token_expires_at);
  if (tokenExpiresAt < new Date()) {
    logger.error('[GET-QUOTE-BY-TOKEN] Token expired');
    return errorResponse('Le lien de ce devis a expiré', 400);
  }

  // Vérifier si le devis a expiré
  const validUntil = new Date(quote.valid_until);
  if (validUntil < new Date() && quote.status === 'pending') {
    await supabaseAdmin
      .from('quotes')
      .update({ status: 'expired' })
      .eq('id', quote.id);
    quote.status = 'expired';
  }

  // ✅ OPTIMISATION: Mettre à jour client_last_viewed_at si utilisateur connecté et est le client
  if (authenticatedUserId && quote.client_user_id === authenticatedUserId) {
    await supabaseAdmin
      .from('quotes')
      .update({ client_last_viewed_at: new Date().toISOString() })
      .eq('id', quote.id);
  }

  // Extraire le nom du vendeur depuis le join
  const sellerProfile = quote.seller as any;
  const sellerName = sellerProfile?.company_name || 
                    `${sellerProfile?.first_name || ''} ${sellerProfile?.last_name || ''}`.trim() ||
                    'Le vendeur';

  logger.log('[GET-QUOTE-BY-TOKEN] Quote retrieved successfully');

  return successResponse({ 
    quote: {
      id: quote.id,
      title: quote.title,
      description: quote.description,
      items: quote.items,
      subtotal: quote.subtotal,
      tax_rate: quote.tax_rate,
      tax_amount: quote.tax_amount,
      total_amount: quote.total_amount,
      currency: quote.currency,
      service_date: quote.service_date,
      service_end_date: quote.service_end_date,
      valid_until: quote.valid_until,
      status: quote.status,
      client_name: quote.client_name,
      client_email: quote.client_email,
      seller_name: sellerName,
      created_at: quote.created_at,
      conversation_id: quote.conversation_id
    }
  });
};

const composedHandler = compose(
  withCors,
  withValidation(getQuoteSchema)
)(handler);

serve(composedHandler);
