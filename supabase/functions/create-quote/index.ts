import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QuoteItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface CreateQuoteRequest {
  client_email: string;
  client_name?: string;
  title: string;
  description?: string;
  items: QuoteItem[];
  currency: 'eur' | 'chf';
  service_date?: string;
  service_end_date?: string;
  valid_until: string;
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

    const body: CreateQuoteRequest = await req.json();

    // Validation
    if (!body.client_email || !body.title || !body.items || body.items.length === 0) {
      throw new Error('Missing required fields');
    }

    // Calculer totaux
    const subtotal = body.items.reduce((sum, item) => sum + item.total, 0);
    
    // Récupérer le profil du vendeur pour obtenir le tax_rate
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('vat_rate, tva_rate')
      .eq('user_id', userData.user.id)
      .single();

    const taxRate = profile?.vat_rate || profile?.tva_rate || 0;
    const taxAmount = subtotal * (taxRate / 100);
    const totalAmount = subtotal + taxAmount;

    // Créer le devis
    const { data: quote, error: quoteError } = await supabaseAdmin
      .from('quotes')
      .insert({
        seller_id: userData.user.id,
        client_email: body.client_email,
        client_name: body.client_name || null,
        title: body.title,
        description: body.description || null,
        items: body.items,
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        currency: body.currency,
        service_date: body.service_date || null,
        service_end_date: body.service_end_date || null,
        valid_until: body.valid_until,
        status: 'pending'
      })
      .select()
      .single();

    if (quoteError) throw quoteError;

    // Log activité
    await supabaseAdmin.from('activity_logs').insert({
      user_id: userData.user.id,
      activity_type: 'quote_created',
      title: 'Devis créé',
      description: `Devis "${body.title}" envoyé à ${body.client_email}`,
      metadata: { quote_id: quote.id }
    });

    // TODO: Envoyer email au client avec le lien du devis
    const quoteLink = `${req.headers.get('origin')}/quote/${quote.secure_token}`;
    console.log('Quote created, link:', quoteLink);

    return new Response(
      JSON.stringify({ success: true, quote, quote_link: quoteLink }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('create-quote error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
