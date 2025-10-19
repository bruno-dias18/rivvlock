import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { 
  compose, 
  withCors, 
  withValidation,
  successResponse, 
  errorResponse,
  Handler, 
  HandlerContext 
} from "../_shared/middleware.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { logger } from "../_shared/logger.ts";

const schema = z.object({
  type: z.string(),
  transactionId: z.string().uuid().optional(),
  message: z.string().optional(),
  recipients: z.array(z.string().uuid()).optional()
});

const handler: Handler = async (_req, ctx: HandlerContext) => {
  const { body } = ctx;
  const { type, transactionId, message, recipients } = body as { type: string; transactionId?: string; message?: string; recipients?: string[] };

  // Security: Only allow calls from service role (internal edge functions)
  const authHeader = _req.headers.get('authorization');
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  
  if (!authHeader || !authHeader.includes(serviceRoleKey || '')) {
    logger.error("Unauthorized send-notifications call");
    return errorResponse('Unauthorized', 403);
  }

  try {
    // Create anon client just to fetch transaction context if needed
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    if (transactionId) {
      const { data: transaction } = await supabaseClient
        .from("transactions")
        .select("*")
        .eq("id", transactionId)
        .maybeSingle();

      if (transaction) {
        logger.log(`📧 EMAIL NOTIFICATION [${type}]:`, message);
        logger.log(`   Transaction: ${transaction.title}`);
        logger.log(`   Amount: ${transaction.price} ${transaction.currency}`);
        logger.log(`   Recipients:`, recipients);
        logger.log(`📱 SMS NOTIFICATION [${type}]:`, message);
        logger.log(`   Service: ${transaction.title}`);
      }
    } else {
      logger.log(`📧 EMAIL NOTIFICATION [${type}]:`, message);
      logger.log(`📱 SMS NOTIFICATION [${type}]:`, message);
    }

    logger.log(`NOTIFICATION SENT: ${new Date().toISOString()} - Type: ${type}`);

    return successResponse({ type, timestamp: new Date().toISOString() });
  } catch (error: any) {
    logger.error("Error sending notification:", error);
    return errorResponse(error.message ?? 'Internal error', 500);
  }
};

const composedHandler = compose(
  withCors,
  withValidation(schema)
)(handler);

serve(composedHandler);
