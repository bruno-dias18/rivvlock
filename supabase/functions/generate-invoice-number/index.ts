import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { logger } from "../_shared/logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InvoiceRequest {
  transactionId: string;
  sellerId: string;
  buyerId?: string;
  amount: number;
  currency: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { transactionId, sellerId, buyerId, amount, currency }: InvoiceRequest = await req.json();

    if (!transactionId || !sellerId || !amount || !currency) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const currentYear = new Date().getFullYear();
    let invoiceNumber: string;

    // Generate seller code (first 4 chars of UUID without dashes, uppercase)
    const sellerCode = sellerId.replace(/-/g, '').substring(0, 4).toUpperCase();

    // Perform atomic transaction to get next sequence number
    const { data: sequenceData, error: sequenceError } = await supabaseClient.rpc('get_next_invoice_sequence', {
      p_seller_id: sellerId,
      p_year: currentYear
    });

    if (sequenceError) {
      logger.error('Error getting sequence:', sequenceError);
      
      // Try to create new sequence if doesn't exist
      const { data: insertData, error: insertError } = await supabaseClient
        .from('invoice_sequences')
        .upsert({
          seller_id: sellerId,
          year: currentYear,
          current_sequence: 1
        }, {
          onConflict: 'seller_id,year'
        })
        .select('current_sequence')
        .single();

      if (insertError) {
        logger.error('Error creating sequence:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to generate invoice number' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      invoiceNumber = `FAC-${currentYear}-${sellerCode}-${String(insertData.current_sequence).padStart(5, '0')}`;
    } else {
      // Increment sequence atomically
      const { data: updateData, error: updateError } = await supabaseClient
        .from('invoice_sequences')
        .update({ 
          current_sequence: sequenceData + 1,
          updated_at: new Date().toISOString()
        })
        .eq('seller_id', sellerId)
        .eq('year', currentYear)
        .select('current_sequence')
        .single();

      if (updateError) {
        logger.error('Error updating sequence:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update sequence' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      invoiceNumber = `FAC-${currentYear}-${sellerCode}-${String(updateData.current_sequence).padStart(5, '0')}`;
    }

    // Store the invoice record
    const { error: invoiceError } = await supabaseClient
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        transaction_id: transactionId,
        seller_id: sellerId,
        buyer_id: buyerId,
        amount: amount,
        currency: currency,
        pdf_metadata: {
          generated_at: new Date().toISOString(),
          seller_code: sellerCode,
          year: currentYear
        }
      });

    if (invoiceError) {
      logger.error('Error storing invoice:', invoiceError);
      return new Response(
        JSON.stringify({ error: 'Failed to store invoice record' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    logger.log(`Generated invoice number: ${invoiceNumber} for seller: ${sellerId}`);

    return new Response(
      JSON.stringify({ 
        invoiceNumber,
        sellerCode,
        year: currentYear
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    logger.error('Error in generate-invoice-number function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});