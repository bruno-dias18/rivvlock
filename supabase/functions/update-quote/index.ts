import { compose, withCors, withAuth, successResponse, errorResponse } from "../_shared/middleware.ts";
import { logger } from "../_shared/logger.ts";

const handler = compose(
  withCors,
  withAuth
)(async (req, ctx) => {
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
  const { data: existingQuote, error: fetchError } = await ctx.supabaseClient!
    .from('quotes')
    .select('*')
    .eq('id', quote_id)
    .eq('seller_id', ctx.user!.id)
    .single();

  if (fetchError || !existingQuote) {
    return errorResponse('Quote not found or unauthorized', 404);
  }

  // Check quote is not in a final status
  if (['accepted', 'refused', 'archived'].includes(existingQuote.status)) {
    return errorResponse('Cannot modify a quote with final status', 400);
  }

  // Calculate subtotal and tax
  const subtotal = items.reduce((sum: number, item: any) => sum + item.total, 0);
  
  // Get seller's profile for tax rate
  const { data: profile } = await ctx.supabaseClient!
    .from('profiles')
    .select('vat_rate, tva_rate')
    .eq('user_id', ctx.user!.id)
    .single();

  const taxRate = profile?.vat_rate || profile?.tva_rate || 0;
  const taxAmount = subtotal * (taxRate / 100);

  // Calculate discount amount if applicable
  const discountAmount = discount_percentage 
    ? subtotal * (discount_percentage / 100) 
    : 0;
  
  const subtotalAfterDiscount = subtotal - discountAmount;
  const taxAmountAfterDiscount = subtotalAfterDiscount * (taxRate / 100);

  // Update the quote
  const { error: updateError } = await ctx.adminClient!
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
      tax_amount: taxAmountAfterDiscount,
      discount_percentage: discount_percentage || null,
      total_amount: total_amount || (subtotalAfterDiscount + taxAmountAfterDiscount),
      fee_ratio_client: fee_ratio_client || 0,
      updated_at: new Date().toISOString()
    })
    .eq('id', quote_id);

  if (updateError) {
    logger.error('Error updating quote:', updateError);
    return errorResponse('Failed to update quote', 500);
  }

  logger.log(`Quote ${quote_id} updated successfully by user ${ctx.user!.id}`);
  return successResponse({ quote_id });
});

Deno.serve(handler);
