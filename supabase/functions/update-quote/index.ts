import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const {
      quote_id,
      title,
      description,
      items,
      currency,
      service_date,
      service_end_date,
      valid_until,
      total_amount,
      fee_ratio_client,
      discount_percentage
    } = await req.json();

    // Verify user is the seller of this quote
    const { data: existingQuote, error: fetchError } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', quote_id)
      .eq('seller_id', user.id)
      .single();

    if (fetchError || !existingQuote) {
      throw new Error('Quote not found or unauthorized');
    }

    // Check quote is not in a final status
    if (['accepted', 'refused', 'archived'].includes(existingQuote.status)) {
      throw new Error('Cannot modify a quote with final status');
    }

    // Calculate subtotal, tax, etc.
    const subtotal = items.reduce((sum: number, item: any) => sum + item.total, 0);
    const taxRate = 0; // Will be calculated based on seller's profile
    const taxAmount = subtotal * (taxRate / 100);

    // Update the quote
    const { error: updateError } = await supabase
      .from('quotes')
      .update({
        title,
        description,
        items,
        currency,
        service_date,
        service_end_date,
        valid_until,
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total_amount,
        fee_ratio_client,
        discount_percentage: discount_percentage || 0,
        status: 'negotiating',
        updated_at: new Date().toISOString()
      })
      .eq('id', quote_id);

    if (updateError) {
      console.error('Error updating quote:', updateError);
      throw updateError;
    }

    // Send a message to the conversation
    if (existingQuote.conversation_id) {
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: existingQuote.conversation_id,
          sender_id: user.id,
          message: 'Le devis a été modifié. Veuillez consulter la nouvelle version.',
          message_type: 'proposal_update',
          metadata: {
            action: 'quote_modified'
          }
        });

      if (messageError) {
        console.error('Error sending message:', messageError);
      }
    }

    // Send email notification to client
    const { error: emailError } = await supabase.functions.invoke('send-email', {
      body: {
        to: existingQuote.client_email,
        subject: `Devis modifié - ${title}`,
        template: 'quote-modified',
        data: {
          client_name: existingQuote.client_name || existingQuote.client_email,
          quote_title: title,
          quote_link: `${supabaseUrl.replace('https://', 'https://app.')}/quote/${quote_id}/${existingQuote.secure_token}`
        }
      }
    });

    if (emailError) {
      console.error('Error sending email:', emailError);
    }

    return new Response(
      JSON.stringify({ 
        success: true
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in update-quote:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
