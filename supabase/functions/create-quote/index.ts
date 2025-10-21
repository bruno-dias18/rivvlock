import { compose, withCors, withAuth, successResponse, errorResponse, withValidation } from "../_shared/middleware.ts";
import { logger } from "../_shared/logger.ts";
import { buildQuoteViewUrl } from "../_shared/app-url.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

interface QuoteItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

// Validation Zod stricte - client_email et client_name optionnels
const createQuoteSchema = z.object({
  client_email: z.string().email().optional().nullable(),
  client_name: z.string().min(1).max(200).optional().nullable(),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional().nullable(),
  items: z.array(z.object({
    description: z.string().min(1).max(500),
    quantity: z.number().positive(),
    unit_price: z.number().nonnegative(),
    total: z.number().nonnegative()
  })).min(1).max(100),
  currency: z.enum(['eur', 'chf']),
  service_date: z.string().optional().nullable(),
  service_end_date: z.string().optional().nullable(),
  valid_until: z.string(),
  total_amount: z.number().positive().optional(),
  fee_ratio_client: z.number().min(0).max(100).optional()
});

interface CreateQuoteRequest {
  client_email?: string | null;
  client_name?: string | null;
  title: string;
  description?: string | null;
  items: QuoteItem[];
  currency: 'eur' | 'chf';
  service_date?: string | null;
  service_end_date?: string | null;
  valid_until: string;
  total_amount?: number;
  fee_ratio_client?: number;
}

const handler = compose(
  withCors,
  withAuth,
  withValidation(createQuoteSchema)
)(async (req, ctx) => {
  const body: CreateQuoteRequest = ctx.body!;

  logger.log(`[create-quote] Creating quote for user ${ctx.user!.id}`);

  // Validation supplémentaire métier
  if (!body.title || !body.items || body.items.length === 0) {
    return errorResponse('Missing required fields: title, items', 400);
  }

  // Calculate totals
  const subtotal = body.items.reduce((sum, item) => sum + item.total, 0);
  
  // Get seller's profile for tax rate (optimisé avec maybeSingle)
  const { data: profile } = await ctx.supabaseClient!
    .from('profiles')
    .select('vat_rate, tva_rate')
    .eq('user_id', ctx.user!.id)
    .maybeSingle();

  const taxRate = profile?.vat_rate || profile?.tva_rate || 0;
  const taxAmount = subtotal * (taxRate / 100);
  
  // Validation: total_amount doit être >= subtotal + taxAmount
  const calculatedTotal = subtotal + taxAmount;
  const totalAmount = body.total_amount || calculatedTotal;
  
  if (totalAmount < calculatedTotal) {
    return errorResponse('Invalid total_amount: must be >= subtotal + taxes', 400);
  }
  
  const feeRatioClient = body.fee_ratio_client || 0;

  // ✅ OPTIMISATION: Create quote + récupérer en 1 seule requête (pas 2)
  // Le secure_token est auto-généré par la DB (default value)
  const { data: quote, error: quoteError } = await ctx.adminClient!
    .from('quotes')
    .insert({
      seller_id: ctx.user!.id,
      client_email: body.client_email || null,
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
      status: 'pending' // ✅ CORRECTION: 'pending' au lieu de 'draft'
    })
    .select('id, secure_token') // ✅ Récupérer le token auto-généré
    .single();

  if (quoteError || !quote) {
    logger.error('[create-quote] Error creating quote:', quoteError);
    return errorResponse('Failed to create quote', 500);
  }

  logger.log(`[create-quote] Quote ${quote.id} created successfully`);
  
  // ✅ OPTIMISATION: Utiliser secure_token + URL builder partagé
  const viewUrl = buildQuoteViewUrl(quote.secure_token, quote.id);
  
  return successResponse({ 
    success: true, 
    quote_id: quote.id,
    secure_token: quote.secure_token,
    view_url: viewUrl
  });
});

Deno.serve(handler);
