import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { logger } from "../_shared/production-logger.ts";
import { 
  compose, 
  withCors, 
  withAuth, 
  successResponse, 
  errorResponse,
  Handler, 
  HandlerContext 
} from "../_shared/middleware.ts";

const handler: Handler = async (req, ctx: HandlerContext) => {
  const { user, supabaseClient } = ctx;
  
  try {
    logger.info('[get-transactions-enriched] Fetching for user:', user!.id);

    // Fetch user's transactions
    const { data: transactions, error: txError } = await supabaseClient!
      .from('transactions')
      .select('*')
      .or(`user_id.eq.${user!.id},buyer_id.eq.${user!.id}`)
      .order('created_at', { ascending: false })
      .limit(200);

    if (txError) {
      logger.error('Error fetching transactions:', txError);
      throw txError;
    }

    if (!transactions || transactions.length === 0) {
      return successResponse([]);
    }

    logger.info('[get-transactions-enriched] Processing transactions:', transactions.length);

    // Enrich transactions with additional data (e.g., dispute status)
    // and perform any necessary data transformations.
    // This example adds a placeholder 'enriched' field.

    const processedTransactions = await Promise.all(
      transactions.map(async (transaction) => {
        try {
          // Calcul du refund_percentage côté serveur
          let refundPercentage = 0;

          if (transaction.status === 'disputed') {
            const { data: dispute } = await supabaseClient!
              .from('disputes')
              .select('id, status')
              .eq('transaction_id', transaction.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (dispute) {
              const { data: acceptedProposal } = await supabaseClient!
                .from('dispute_proposals')
                .select('refund_percentage, status')
                .eq('dispute_id', dispute.id)
                .eq('status', 'accepted')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

              if (acceptedProposal) {
                refundPercentage = acceptedProposal.refund_percentage || 0;
              }
            }
          }

          return {
            ...transaction,
            refund_percentage: refundPercentage,
          };
        } catch (err) {
          logger.error('[get-transactions-enriched] Error processing transaction:', transaction.id, err);
          return {
            ...transaction,
            refund_percentage: 0,
          };
        }
      })
    );

    logger.info('[get-transactions-enriched] Processed transactions:', processedTransactions.length);

    return successResponse(processedTransactions);
  } catch (error) {
    logger.error('[get-transactions-enriched] Error:', error);
    return errorResponse(error instanceof Error ? error.message : String(error), 500);
  }
};

const composedHandler = compose(withCors, withAuth)(handler);
serve(composedHandler);
