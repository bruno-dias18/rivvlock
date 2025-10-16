import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logger } from "../_shared/logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResendQuoteEmailRequest {
  quote_id: string;
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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) throw new Error('Not authenticated');

    const body: ResendQuoteEmailRequest = await req.json();

    if (!body.quote_id) {
      throw new Error('Missing required field: quote_id');
    }

    logger.log('[RESEND-QUOTE-EMAIL] Fetching quote:', body.quote_id);

    // Récupérer le devis
    const { data: quote, error: quoteError } = await supabaseAdmin
      .from('quotes')
      .select('*')
      .eq('id', body.quote_id)
      .single();

    if (quoteError || !quote) {
      throw new Error('Quote not found');
    }

    // Vérifier que l'utilisateur est bien le vendeur
    if (quote.seller_id !== userData.user.id) {
      throw new Error('Unauthorized: You are not the seller of this quote');
    }

    logger.log('[RESEND-QUOTE-EMAIL] Quote found, seller verified');

    // Récupérer le profil du vendeur
    const { data: sellerProfile } = await supabaseAdmin
      .from('profiles')
      .select('first_name, last_name, company_name')
      .eq('user_id', userData.user.id)
      .single();

    const sellerName = sellerProfile?.company_name || 
                      `${sellerProfile?.first_name || ''} ${sellerProfile?.last_name || ''}`.trim() ||
                      'Le vendeur';

    // Générer le lien du devis
    const origin = req.headers.get('origin') || 'https://app.rivvlock.com';
    const quoteLink = `${origin}/quote/${quote.id}/${quote.secure_token}`;

    logger.log('[RESEND-QUOTE-EMAIL] Sending email to:', quote.client_email);

    // Envoyer l'email via send-email function
    const { error: emailError } = await supabaseAdmin.functions.invoke('send-email', {
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
      throw new Error('Failed to send email');
    }

    // Logger l'activité
    await supabaseAdmin.from('activity_logs').insert({
      user_id: userData.user.id,
      activity_type: 'quote_email_resent',
      title: 'Email de devis renvoyé',
      description: `Email du devis "${quote.title}" renvoyé à ${quote.client_email}`,
      metadata: { quote_id: quote.id }
    });

    logger.log('[RESEND-QUOTE-EMAIL] Email sent successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email sent successfully',
        client_email: quote.client_email
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[RESEND-QUOTE-EMAIL] Error:', errorMessage);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
