import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
import { logger } from "../_shared/logger.ts";

const schema = z.object({
  sellerUserId: z.string().uuid().optional(),
  buyerUserId: z.string().uuid().optional()
}).refine(d => d.sellerUserId || d.buyerUserId, { message: 'At least one of sellerUserId or buyerUserId is required' });

const handler: Handler = async (_req, ctx: HandlerContext) => {
  const { user, supabaseClient, adminClient, body } = ctx;
  const { sellerUserId, buyerUserId } = body;

  try {
    // Check if user is admin
    const { data: isAdmin } = await supabaseClient!.rpc('check_admin_role', { _user_id: user!.id });

    // Check if user is a transaction participant
    let isAuthorized = isAdmin === true;
    if (!isAuthorized && sellerUserId && buyerUserId) {
      const { data: isCounterparty } = await supabaseClient!.rpc('are_transaction_counterparties', {
        user_a: user!.id,
        user_b: sellerUserId
      });
      const { data: isCounterparty2 } = await supabaseClient!.rpc('are_transaction_counterparties', {
        user_a: user!.id,
        user_b: buyerUserId
      });
      isAuthorized = Boolean(isCounterparty) || Boolean(isCounterparty2);
    }

    if (!isAuthorized) {
      logger.error('Unauthorized access attempt', { userId: user!.id, sellerUserId, buyerUserId });
      return errorResponse('Unauthorized', 403);
    }

    // Get seller email
    let sellerEmail: string | null = null;
    if (sellerUserId) {
      const { data: sellerData } = await adminClient!.auth.admin.getUserById(sellerUserId);
      sellerEmail = sellerData.user?.email ?? null;
      await adminClient!.from('profile_access_logs').insert({
        accessed_profile_id: sellerUserId,
        accessed_by_user_id: user!.id,
        access_type: 'email_access',
        accessed_fields: ['email']
      });
    }

    // Get buyer email
    let buyerEmail: string | null = null;
    if (buyerUserId) {
      const { data: buyerData } = await adminClient!.auth.admin.getUserById(buyerUserId);
      buyerEmail = buyerData.user?.email ?? null;
      await adminClient!.from('profile_access_logs').insert({
        accessed_profile_id: buyerUserId,
        accessed_by_user_id: user!.id,
        access_type: 'email_access',
        accessed_fields: ['email']
      });
    }

    return successResponse({ sellerEmail, buyerEmail });
  } catch (error: any) {
    logger.error('Error:', error);
    return errorResponse(error.message ?? 'Internal error', 400);
  }
};

const composedHandler = compose(
  withCors,
  withAuth,
  withValidation(schema)
)(handler);

serve(composedHandler);
