import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { logger } from "../_shared/logger.ts";
import { buildTransactionJoinUrl } from "../_shared/app-url.ts";
import { 
  compose, 
  withCors, 
  withAuth, 
  withRateLimit, 
  withValidation,
  successResponse,
  Handler,
  HandlerContext
} from "../_shared/middleware.ts";

const createTransactionSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  currency: z.string().length(3),
  service_date: z.string(),
  service_end_date: z.string().nullable().optional(), // ✅ Accept null OR undefined
  client_email: z.string().email().optional(),
  client_name: z.string().optional(),
  buyer_display_name: z.string().optional(),
  fee_ratio_client: z.number().min(0).max(100).optional(),
});

const handler: Handler = async (req, ctx: HandlerContext) => {
  const { user, supabaseClient, adminClient, body } = ctx;
  const { 
    title, description, price, currency, service_date, service_end_date,
    client_email, client_name, buyer_display_name, fee_ratio_client 
  } = body;
  
  // Use client_name if provided, fallback to buyer_display_name
  const finalBuyerDisplayName = client_name || buyer_display_name || null;

  logger.log('[CREATE-TRANSACTION] Processing for user:', user!.id);

  // Calculate deadlines
  const serviceDate = new Date(service_date);
  const paymentDeadline = new Date(serviceDate.getTime() - 24 * 60 * 60 * 1000);
  const validationDeadline = new Date(serviceDate.getTime() + 48 * 60 * 60 * 1000);

  // Get seller display name
  const { data: profile } = await supabaseClient!
    .from('profiles')
    .select('company_name, first_name, last_name')
    .eq('user_id', user!.id)
    .single();

  const sellerDisplayName = profile?.company_name || 
    `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 
    'Vendeur';

  // Generate secure share token using database function
  const { data: tokenData, error: tokenError } = await adminClient!
    .rpc('generate_secure_token');
  
  if (tokenError) {
    logger.error('[CREATE-TRANSACTION] Token generation error:', tokenError);
    throw new Error('Failed to generate secure token');
  }

  const shareToken = tokenData as string;
  const shareExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  // Insert transaction with share token
  const { data: transaction, error: insertError } = await supabaseClient!
    .from('transactions')
    .insert({
      user_id: user!.id,
      title,
      description,
      price,
      currency,
      service_date,
      service_end_date: service_end_date || null,
      payment_deadline: paymentDeadline.toISOString(),
      validation_deadline: validationDeadline.toISOString(),
      status: 'pending',
      seller_display_name: sellerDisplayName,
      buyer_display_name: finalBuyerDisplayName,
      client_email: client_email || null,
      fee_ratio_client: fee_ratio_client || null,
      shared_link_token: shareToken,
      shared_link_expires_at: shareExpiresAt.toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    logger.error('[CREATE-TRANSACTION] Insert error:', {
      code: insertError.code,
      message: insertError.message,
      details: insertError.details,
      hint: insertError.hint
    });
    throw new Error(`Failed to create transaction: ${insertError.message}`);
  }

  logger.log('[CREATE-TRANSACTION] Transaction created:', transaction.id);

  // Build share link URL using shared utility
  const shareLink = buildTransactionJoinUrl(shareToken);

  // Send email if client_email provided
  if (client_email) {
    try {
      await adminClient!.functions.invoke('send-email', {
        body: {
          type: 'transaction_created',
          to: client_email,
          data: {
            transactionId: transaction.id,
            transactionTitle: title,
            serviceDate: service_date,
          }
        }
      });
      logger.log('[CREATE-TRANSACTION] Email sent to:', client_email);
    } catch (emailError) {
      logger.error('[CREATE-TRANSACTION] Email error:', emailError);
    }
  }

  // Log activity
  await supabaseClient!
    .from('activity_logs')
    .insert({
      user_id: user!.id,
      activity_type: 'transaction_created',
      title: `Transaction créée : "${title}"`,
      description: `Montant: ${price} ${currency}`,
      metadata: {
        transaction_id: transaction.id,
        price,
        currency
      }
    });

  return successResponse({ 
    transaction: {
      ...transaction,
      shareLink
    }
  });
};

// Compose all middlewares and serve
const composedHandler = compose(
  withCors,
  withAuth,
  withRateLimit(),
  withValidation(createTransactionSchema)
)(handler);

serve(composedHandler);
