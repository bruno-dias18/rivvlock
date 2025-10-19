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
  transactionId: z.string().uuid(),
});

const handler: Handler = async (_req, ctx: HandlerContext) => {
  const { user, supabaseClient, adminClient, body } = ctx;
  const { transactionId } = body;

  try {
    // Verify user is part of this transaction
    const { data: transaction, error: txError } = await adminClient!
      .from('transactions')
      .select('user_id, buyer_id, status')
      .eq('id', transactionId)
      .single();

    if (txError || !transaction) {
      return errorResponse('Transaction not found', 404);
    }

    // Check authorization: user must be seller or buyer
    if (user!.id !== transaction.user_id && user!.id !== transaction.buyer_id) {
      logger.error('Unauthorized invoice data access attempt:', {
        userId: user!.id,
        transactionId,
        sellerId: transaction.user_id,
        buyerId: transaction.buyer_id
      });
      return errorResponse('Unauthorized access', 403);
    }

    // Check if user is admin (for logging purposes)
    const { data: isAdminResult } = await supabaseClient!.rpc('get_current_user_admin_status');
    const isAdmin = isAdminResult === true;

    // Use secure functions to fetch only necessary profile fields
    const { data: sellerProfile, error: sellerError } = await adminClient!
      .rpc('get_seller_invoice_data', { 
        p_seller_id: transaction.user_id,
        p_requesting_user_id: user!.id
      });

    if (sellerError) {
      logger.error('Error fetching seller profile:', sellerError);
    }

    // Fetch buyer profile with minimal fields using secure function
    let buyerProfile = null as any;
    if (transaction.buyer_id) {
      const { data, error: buyerError } = await adminClient!
        .rpc('get_buyer_invoice_data', {
          p_buyer_id: transaction.buyer_id,
          p_requesting_user_id: user!.id
        });

      if (buyerError) {
        logger.error('Error fetching buyer profile:', buyerError);
      }
      // RPC returns an array, get first element
      buyerProfile = data && data.length > 0 ? data[0] : null;
    }

    // Log access for audit trail (with admin flag if applicable)
    const accessType = isAdmin ? 'admin_invoice_generation' : 'invoice_generation';
    await adminClient!
      .from('profile_access_logs')
      .insert({
        accessed_profile_id: user!.id === transaction.user_id ? transaction.buyer_id : transaction.user_id,
        accessed_by_user_id: user!.id,
        access_type: accessType,
        accessed_fields: user!.id === transaction.user_id 
          ? ['first_name', 'last_name', 'company_name', 'user_type', 'country', 'address', 'postal_code', 'city', 'phone']
          : ['first_name', 'last_name', 'company_name', 'user_type', 'country', 'address', 'postal_code', 'city', 'siret_uid', 'vat_rate', 'tva_rate', 'is_subject_to_vat', 'avs_number', 'vat_number', 'phone']
      });

    return successResponse({ 
      // RPC functions return arrays, get first element
      sellerProfile: sellerProfile && sellerProfile.length > 0 ? sellerProfile[0] : null,
      buyerProfile
    });

  } catch (error: any) {
    logger.error('Error in get-invoice-data:', error);
    return errorResponse(error.message ?? 'Internal error', 500);
  }
};

const composedHandler = compose(
  withCors,
  withAuth,
  withValidation(schema)
)(handler);

serve(composedHandler);
