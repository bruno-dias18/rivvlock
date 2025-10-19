import { compose, withCors, withAuth, successResponse, errorResponse } from "../_shared/middleware.ts";
import { logger } from "../_shared/logger.ts";

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

const handler = compose(
  withCors,
  withAuth
)(async (req, ctx) => {
  const body: CreateQuoteRequest = await req.json();

  // Validation
  if (!body.client_email || !body.title || !body.items || body.items.length === 0) {
    return errorResponse('Missing required fields: client_email, title, items', 400);
  }

  // Calculate totals
  const subtotal = body.items.reduce((sum, item) => sum + item.total, 0);
  
  // Get seller's profile for tax rate
  const { data: profile } = await ctx.supabaseClient!
    .from('profiles')
    .select('vat_rate, tva_rate')
    .eq('user_id', ctx.user!.id)
    .single();

  const taxRate = profile?.vat_rate || profile?.tva_rate || 0;
  const taxAmount = subtotal * (taxRate / 100);
  
  // Use provided total_amount (including client fees) or calculate standard total
  const totalAmount = body.total_amount || (subtotal + taxAmount);
  const feeRatioClient = body.fee_ratio_client || 0;

  // Create the quote
  const { data: quote, error: quoteError } = await ctx.adminClient!
    .from('quotes')
    .insert({
      seller_id: ctx.user!.id,
      client_email: body.client_email,
      client_name: body.client_name || null,
      title: body.title,
      description: body.description || null,
      items: body.items,
      currency: body.currency,
      service_date: body.service_date || null,
      service_end_date: body.service_end_date || null,
      valid_until: body.valid_until,
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      fee_ratio_client: feeRatioClient,
      status: 'draft'
    })
    .select()
    .single();

  if (quoteError || !quote) {
    logger.error('Error creating quote:', quoteError);
    return errorResponse('Failed to create quote', 500);
  }

  // Generate secure viewing token
  const viewToken = crypto.randomUUID();
  
  const { error: tokenError } = await ctx.adminClient!
    .from('quotes')
    .update({ view_token: viewToken })
    .eq('id', quote.id);

  if (tokenError) {
    logger.error('Error adding token:', tokenError);
  }

  logger.log(`Quote ${quote.id} created successfully by user ${ctx.user!.id}`);
  
  return successResponse({ 
    success: true, 
    quote_id: quote.id,
    view_token: viewToken,
    view_url: `${req.headers.get('origin')}/quote/${quote.id}/${viewToken}`
  });
});

Deno.serve(handler);
