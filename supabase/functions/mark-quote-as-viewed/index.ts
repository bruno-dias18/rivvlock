import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { 
  compose, 
  withCors, 
  withAuth, 
  withValidation, 
  successResponse,
  errorResponse,
  Handler,
  HandlerContext 
} from "../_shared/middleware.ts";

const markQuoteSchema = z.object({
  quoteId: z.string().uuid(),
});

const handler: Handler = async (req, ctx: HandlerContext) => {
  const { user, supabaseClient, adminClient, body } = ctx;
  const { quoteId } = body;

  // Get the quote to verify the user is the client
  const { data: quote, error: quoteError } = await supabaseClient!
    .from('quotes')
    .select('client_user_id, seller_id')
    .eq('id', quoteId)
    .single();

  if (quoteError || !quote) {
    return errorResponse('Quote not found', 404);
  }

  // Only the client can mark the quote as viewed
  if (quote.client_user_id !== user!.id) {
    return errorResponse('Not authorized - only the client can mark as viewed', 403);
  }

  // Update using adminClient to bypass RLS (client can't UPDATE quotes)
  const { error: updateError } = await adminClient!
    .from('quotes')
    .update({ client_last_viewed_at: new Date().toISOString() })
    .eq('id', quoteId);

  if (updateError) {
    console.error('Error updating quote view timestamp:', updateError);
    return errorResponse('Failed to update view timestamp', 500);
  }

  return successResponse({});
};

const composedHandler = compose(
  withCors,
  withAuth,
  withValidation(markQuoteSchema)
)(handler);

Deno.serve(composedHandler);
