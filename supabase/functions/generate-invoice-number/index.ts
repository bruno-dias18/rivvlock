import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { 
  compose, 
  withCors, 
  withRateLimit, 
  withValidation,
  successResponse, 
  errorResponse,
  Handler, 
  HandlerContext 
} from "../_shared/middleware.ts";
import { createServiceClient } from "../_shared/supabase-utils.ts";
import { logger } from "../_shared/logger.ts";

const schema = z.object({
  transactionId: z.string().uuid(),
  sellerId: z.string().uuid(),
  buyerId: z.string().uuid().optional(),
  amount: z.number().positive(),
  currency: z.string().min(1),
});

const handler: Handler = async (_req, ctx: HandlerContext) => {
  const { body } = ctx;
  const { transactionId, sellerId, buyerId, amount, currency } = body;

  try {
    const supabaseClient = createServiceClient();

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
        return errorResponse('Failed to generate invoice number', 500);
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
        return errorResponse('Failed to update sequence', 500);
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
      return errorResponse('Failed to store invoice record', 500);
    }

    logger.log(`Generated invoice number: ${invoiceNumber} for seller: ${sellerId}`);

    return successResponse({ invoiceNumber, sellerCode, year: currentYear });

  } catch (error) {
    logger.error('Error in generate-invoice-number function:', error);
    return errorResponse('Internal server error', 500);
  }
};

const composedHandler = compose(
  withCors,
  withRateLimit(),
  withValidation(schema)
)(handler);

serve(composedHandler);
