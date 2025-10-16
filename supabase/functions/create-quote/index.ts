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
  total_amount?: number;
  fee_ratio_client?: number;
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
    
    // Utiliser le total_amount du frontend si fourni (incluant les frais client)
    // Sinon, calculer le total standard
    const totalAmount = body.total_amount || (subtotal + taxAmount);
    const feeRatioClient = body.fee_ratio_client || 0;

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
        fee_ratio_client: feeRatioClient,
        status: 'pending'
      })
      .select()
      .single();

    if (quoteError) throw quoteError;

    // Create a conversation for this quote (unified messaging)
    try {
      const { data: conversation, error: convError } = await supabaseAdmin
        .from('conversations')
        .insert({
          seller_id: userData.user.id,
          buyer_id: null,
          quote_id: quote.id,
          status: 'active'
        })
        .select()
        .single();

      if (convError) {
        console.error('[create-quote] Error creating conversation:', convError);
      } else if (conversation) {
        // Link conversation back to quote
        await supabaseAdmin
          .from('quotes')
          .update({ conversation_id: conversation.id })
          .eq('id', quote.id);
      }
    } catch (convErr) {
      console.error('[create-quote] Conversation creation error:', convErr);
    }

    // Log activité
    await supabaseAdmin.from('activity_logs').insert({
      user_id: userData.user.id,
      activity_type: 'quote_created',
      title: 'Devis créé',
      description: `Devis "${body.title}" envoyé à ${body.client_email}`,
      metadata: { quote_id: quote.id }
    });

    // Générer le lien du devis
    const origin = req.headers.get('origin') || 'https://app.rivvlock.com';
    const quoteLink = `${origin}/quote/${quote.id}/${quote.secure_token}`;
    console.log('Quote created, link:', quoteLink);

    // Récupérer le nom du vendeur
    const { data: sellerProfile } = await supabaseAdmin
      .from('profiles')
      .select('first_name, last_name, company_name')
      .eq('user_id', userData.user.id)
      .single();

    const sellerName = sellerProfile?.company_name || 
                      `${sellerProfile?.first_name || ''} ${sellerProfile?.last_name || ''}`.trim() ||
                      'Le vendeur';

    // Envoyer email au client
    try {
      await supabaseAdmin.functions.invoke('send-email', {
        body: {
          type: 'quote_created',
          to: body.client_email,
          data: {
            clientName: body.client_name || body.client_email,
            sellerName,
            quoteTitle: body.title,
            quoteLink,
            totalAmount: totalAmount.toFixed(2),
            currency: body.currency,
            validUntil: new Date(body.valid_until).toLocaleDateString('fr-FR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })
          }
        }
      });
      console.log('Quote email sent to:', body.client_email);
    } catch (emailError) {
      console.error('Failed to send quote email:', emailError);
      // Ne pas bloquer la création du devis si l'email échoue
    }

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
