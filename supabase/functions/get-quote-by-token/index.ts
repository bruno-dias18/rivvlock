import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logger } from "../_shared/logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GetQuoteRequest {
  quote_id: string;
  secure_token: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body: GetQuoteRequest = await req.json();

    if (!body.quote_id || !body.secure_token) {
      throw new Error('Missing required fields: quote_id and secure_token');
    }

    logger.log('[GET-QUOTE-BY-TOKEN] Fetching quote:', body.quote_id);

    // Récupérer le devis avec vérification du token
    const { data: quote, error: quoteError } = await supabaseAdmin
      .from('quotes')
      .select('*')
      .eq('id', body.quote_id)
      .eq('secure_token', body.secure_token)
      .single();

    if (quoteError || !quote) {
      logger.error('[GET-QUOTE-BY-TOKEN] Quote not found or invalid token');
      throw new Error('Devis non trouvé ou lien invalide');
    }

    // Vérifier si le token a expiré
    const tokenExpiresAt = new Date(quote.token_expires_at);
    if (tokenExpiresAt < new Date()) {
      logger.error('[GET-QUOTE-BY-TOKEN] Token expired');
      throw new Error('Le lien de ce devis a expiré');
    }

    // Vérifier si le devis a expiré
    const validUntil = new Date(quote.valid_until);
    if (validUntil < new Date() && quote.status === 'pending') {
      // Mettre à jour le statut si nécessaire
      await supabaseAdmin
        .from('quotes')
        .update({ status: 'expired' })
        .eq('id', quote.id);
      quote.status = 'expired';
    }

    // Récupérer les informations publiques du vendeur
    const { data: sellerProfile } = await supabaseAdmin
      .from('profiles')
      .select('first_name, last_name, company_name')
      .eq('user_id', quote.seller_id)
      .single();

    const sellerName = sellerProfile?.company_name || 
                      `${sellerProfile?.first_name || ''} ${sellerProfile?.last_name || ''}`.trim() ||
                      'Le vendeur';

    logger.log('[GET-QUOTE-BY-TOKEN] Quote retrieved successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
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
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[GET-QUOTE-BY-TOKEN] Error:', errorMessage);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage 
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
