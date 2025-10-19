import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { logger } from "../_shared/logger.ts";
import { 
  compose, 
  withCors,
  successResponse, 
  errorResponse,
  Handler, 
  HandlerContext 
} from "../_shared/middleware.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  logger.log(`[SYNC-STRIPE] ${step}${detailsStr}`);
};

const handler: Handler = async (req, ctx: HandlerContext) => {
  try {
    logStep("Function started");

    // Create Supabase clients
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get user from auth header (if provided)
    const authHeader = req.headers.get("Authorization");
    let currentUserId = null;
    
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error: userError } = await userClient.auth.getUser(token);
      
      if (!userError && userData.user) {
        currentUserId = userData.user.id;
        logStep("User authenticated", { userId: currentUserId });
      }
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-06-20",
    });

    logStep("Fetching recent Stripe Payment Intents");

    // Get recent Payment Intents from Stripe that require capture (last 30 days)
    const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
    
    const paymentIntents = await stripe.paymentIntents.list({
      limit: 100,
      created: { gte: thirtyDaysAgo },
    });

    logStep("Found Payment Intents from Stripe", { count: paymentIntents.data.length });

    // Filter for uncaptured payments
    const uncapturedPayments = paymentIntents.data.filter((pi: any) => 
      pi.status === 'requires_capture' && pi.capture_method === 'manual'
    );

    logStep("Uncaptured Payment Intents found", { count: uncapturedPayments.length });

    if (uncapturedPayments.length === 0) {
      return successResponse({ 
        message: "No uncaptured payments found in Stripe",
        synchronized: 0
      });
    }

    // Get all transactions from RivvLock (admin client to bypass RLS)
    const { data: transactions, error: transactionsError } = await adminClient
      .from("transactions")
      .select("*")
      .in("status", ["pending", "paid", "validated"]); // Include validated for backfill

    if (transactionsError) {
      throw new Error(`Failed to fetch transactions: ${transactionsError.message}`);
    }

    logStep("Fetched RivvLock transactions", { count: transactions?.length || 0 });

    let synchronizedCount = 0;
    const syncResults = [];

    // Check each uncaptured payment against RivvLock transactions
    for (const paymentIntent of uncapturedPayments) {
      try {
        logStep("Processing Payment Intent", { 
          id: paymentIntent.id, 
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          metadata: paymentIntent.metadata
        });

        // Strategy 1: Match by payment intent ID
        let matchingTransaction = transactions?.find(t => 
          t.stripe_payment_intent_id === paymentIntent.id
        );

        // Strategy 2: Match by metadata transaction_id
        if (!matchingTransaction && paymentIntent.metadata?.transaction_id) {
          matchingTransaction = transactions?.find(t => 
            t.id === paymentIntent.metadata.transaction_id
          );
        }

        // Strategy 3: Match by metadata transactionId (alternative key)
        if (!matchingTransaction && paymentIntent.metadata?.transactionId) {
          matchingTransaction = transactions?.find(t => 
            t.id === paymentIntent.metadata.transactionId
          );
        }

        // Strategy 4: Match by amount, currency and timeframe (fallback for payments without metadata)
        if (!matchingTransaction) {
          const paymentAmount = paymentIntent.amount / 100; // Convert from cents
          const paymentDate = new Date(paymentIntent.created * 1000);
          const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
          
          matchingTransaction = transactions?.find(t => {
            const transactionDate = new Date(t.created_at);
            return (
              Math.abs(t.price - paymentAmount) < 0.01 && // Amount match (within 1 cent)
              t.currency.toLowerCase() === paymentIntent.currency.toLowerCase() && // Currency match
              transactionDate > twoDaysAgo && // Created within last 2 days
              t.status === 'pending' // Still pending
            );
          });
          
          if (matchingTransaction) {
            logStep("Matched by amount/currency/date", { 
              transactionId: matchingTransaction.id,
              paymentIntentId: paymentIntent.id 
            });
          }
        }

        if (matchingTransaction) {
          logStep("Found matching transaction", { 
            transactionId: matchingTransaction.id,
            currentStatus: matchingTransaction.status 
          });

          // Update transaction if it's still pending
          if (matchingTransaction.status === 'pending') {
            // Use multiple targeted updates to avoid IBAN validation trigger
            // First update the status and payment intent ID
            const { error: statusUpdateError } = await adminClient
              .from("transactions")
              .update({ 
                status: 'paid',
                stripe_payment_intent_id: paymentIntent.id
              })
              .eq("id", matchingTransaction.id);

            if (statusUpdateError) {
              logStep("Error updating transaction status", { 
                transactionId: matchingTransaction.id, 
                error: statusUpdateError.message 
              });
            }

            // Then update the timestamps separately
            const { error: timestampUpdateError } = await adminClient
              .from("transactions")
              .update({ 
                payment_blocked_at: new Date().toISOString(),
                validation_deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq("id", matchingTransaction.id);

            const updateError = statusUpdateError || timestampUpdateError;

            if (updateError) {
              logStep("Error updating transaction", { 
                transactionId: matchingTransaction.id, 
                error: updateError.message 
              });
              syncResults.push({
                paymentIntentId: paymentIntent.id,
                transactionId: matchingTransaction.id,
                status: 'error',
                error: updateError.message
              });
            } else {
              logStep("Transaction synchronized successfully", { 
                transactionId: matchingTransaction.id,
                paymentIntentId: paymentIntent.id 
              });
              
              // Log activity for funds blocked (for both seller and buyer)
              try {
                // Check if logs already exist to avoid duplicates
                const { data: existingLogs } = await adminClient
                  .from('activity_logs')
                  .select('id, user_id')
                  .eq('activity_type', 'funds_blocked')
                  .filter('metadata->>transaction_id', 'eq', matchingTransaction.id);

                const existingUserIds = existingLogs?.map(log => log.user_id) || [];

                // Log for seller if not exists
                if (!existingUserIds.includes(matchingTransaction.user_id)) {
                  await adminClient
                    .from('activity_logs')
                    .insert({
                      user_id: matchingTransaction.user_id,
                      activity_type: 'funds_blocked',
                      title: 'Fonds bloqués',
                      description: `Les fonds pour "${matchingTransaction.title}" ont été bloqués et sont en sécurité`,
                      metadata: {
                        transaction_id: matchingTransaction.id,
                        amount: matchingTransaction.price,
                        currency: matchingTransaction.currency
                      }
                    });
                }

                // Log for buyer if exists and not already logged
                if (matchingTransaction.buyer_id && !existingUserIds.includes(matchingTransaction.buyer_id)) {
                  await adminClient
                    .from('activity_logs')
                    .insert({
                      user_id: matchingTransaction.buyer_id,
                      activity_type: 'funds_blocked',
                      title: 'Fonds bloqués',
                      description: `Les fonds pour "${matchingTransaction.title}" ont été bloqués et sont en sécurité`,
                      metadata: {
                        transaction_id: matchingTransaction.id,
                        amount: matchingTransaction.price,
                        currency: matchingTransaction.currency
                      }
                    });
                }
              } catch (logError) {
                const logErrorMessage = logError instanceof Error ? logError.message : String(logError);
                logStep("Error logging funds blocked activity", { error: logErrorMessage });
              }
              
              synchronizedCount++;
              syncResults.push({
                paymentIntentId: paymentIntent.id,
                transactionId: matchingTransaction.id,
                status: 'synchronized'
              });
            }
          } else {
            logStep("Transaction already has correct status", { 
              transactionId: matchingTransaction.id,
              status: matchingTransaction.status 
            });

            syncResults.push({
              paymentIntentId: paymentIntent.id,
              transactionId: matchingTransaction.id,
              status: 'already_synced'
            });
          }
        } else {
          logStep("No matching transaction found for Payment Intent", { 
            paymentIntentId: paymentIntent.id 
          });
          syncResults.push({
            paymentIntentId: paymentIntent.id,
            status: 'no_match'
          });
        }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logStep("Error processing Payment Intent", { 
            paymentIntentId: paymentIntent.id, 
            error: errorMessage 
          });
          syncResults.push({
            paymentIntentId: paymentIntent.id,
            status: 'error',
            error: errorMessage
        });
      }
    }

    logStep("Sync complete", { 
      synchronized: synchronizedCount,
      total: uncapturedPayments.length,
      results: syncResults.length 
    });

    return successResponse({ 
      message: "Stripe payment sync completed",
      synchronized: synchronizedCount,
      total_uncaptured: uncapturedPayments.length,
      results: syncResults
    });

  } catch (error) {
    logStep("❌ Function error", error);
    return errorResponse(
      error instanceof Error ? error.message : String(error),
      500
    );
  }
};

const composedHandler = compose(withCors)(handler);
serve(composedHandler);
