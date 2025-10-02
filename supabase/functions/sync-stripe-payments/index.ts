import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SYNC-STRIPE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
      return new Response(JSON.stringify({ 
        success: true,
        message: "No uncaptured payments found in Stripe",
        synchronized: 0
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
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
                  .contains('metadata', { transaction_id: matchingTransaction.id });

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

            // Backfill missing activity logs for already processed transactions
            if (matchingTransaction.status === 'paid') {
              try {
                // Check for missing funds_blocked logs
                const { data: existingLogs } = await adminClient
                  .from('activity_logs')
                  .select('id, user_id')
                  .eq('activity_type', 'funds_blocked')
                  .contains('metadata', { transaction_id: matchingTransaction.id });

                const existingUserIds = existingLogs?.map(log => log.user_id) || [];
                const logsToCreate = [];

                // Log for seller if missing
                if (!existingUserIds.includes(matchingTransaction.user_id)) {
                  logsToCreate.push({
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

                // Log for buyer if missing
                if (matchingTransaction.buyer_id && !existingUserIds.includes(matchingTransaction.buyer_id)) {
                  logsToCreate.push({
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

                if (logsToCreate.length > 0) {
                  await adminClient.from('activity_logs').insert(logsToCreate);
                  logStep("Backfilled missing funds_blocked logs", { 
                    transactionId: matchingTransaction.id, 
                    logsCreated: logsToCreate.length 
                  });
                }
              } catch (backfillError) {
                logStep("Error backfilling funds_blocked logs", { 
                  transactionId: matchingTransaction.id, 
                  error: backfillError 
                });
              }
            }

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

    // Backfill missing activity logs for existing transactions
    logStep("Starting backfill for missing activity logs");
    
    try {
      // Get transactions that might be missing logs
      const paidTransactions = transactions?.filter(t => t.status === 'paid') || [];
      const validatedTransactions = transactions?.filter(t => t.status === 'validated') || [];

      // Backfill funds_blocked logs for paid transactions
      for (const transaction of paidTransactions) {
        try {
          // Check existing logs for this transaction
          const { data: existingLogs } = await adminClient
            .from('activity_logs')
            .select('id, user_id')
            .eq('activity_type', 'funds_blocked')
            .contains('metadata', { transaction_id: transaction.id });

          const existingUserIds = existingLogs?.map(log => log.user_id) || [];

          // Create missing logs
          const logsToCreate = [];

          // Log for seller
          if (!existingUserIds.includes(transaction.user_id)) {
            logsToCreate.push({
              user_id: transaction.user_id,
              activity_type: 'funds_blocked',
              title: 'Fonds bloqués',
              description: `Les fonds pour "${transaction.title}" ont été bloqués et sont en sécurité`,
              metadata: {
                transaction_id: transaction.id,
                amount: transaction.price,
                currency: transaction.currency
              }
            });
          }

          // Log for buyer
          if (transaction.buyer_id && !existingUserIds.includes(transaction.buyer_id)) {
            logsToCreate.push({
              user_id: transaction.buyer_id,
              activity_type: 'funds_blocked',
              title: 'Fonds bloqués',
              description: `Les fonds pour "${transaction.title}" ont été bloqués et sont en sécurité`,
              metadata: {
                transaction_id: transaction.id,
                amount: transaction.price,
                currency: transaction.currency
              }
            });
          }

          if (logsToCreate.length > 0) {
            await adminClient.from('activity_logs').insert(logsToCreate);
            logStep("Backfilled funds_blocked logs", { transactionId: transaction.id, logsCreated: logsToCreate.length });
          }
        } catch (backfillError) {
          logStep("Error backfilling funds_blocked logs", { transactionId: transaction.id, error: backfillError });
        }
      }

      // Backfill transaction_completed logs for validated transactions
      for (const transaction of validatedTransactions) {
        try {
          // Check existing logs for this transaction
          const { data: existingLogs } = await adminClient
            .from('activity_logs')
            .select('id, user_id')
            .eq('activity_type', 'transaction_completed')
            .contains('metadata', { transaction_id: transaction.id });

          const existingUserIds = existingLogs?.map(log => log.user_id) || [];

          // Create missing logs
          const logsToCreate = [];

          // Log for buyer
          if (transaction.buyer_id && !existingUserIds.includes(transaction.buyer_id)) {
            logsToCreate.push({
              user_id: transaction.buyer_id,
              activity_type: 'transaction_completed',
              title: 'Transaction complétée',
              description: `Transaction "${transaction.title}" terminée avec succès. Fonds transférés au vendeur.`,
              metadata: {
                transaction_id: transaction.id,
                amount: transaction.price,
                currency: transaction.currency
              }
            });
          }

          // Log for seller
          if (!existingUserIds.includes(transaction.user_id)) {
            logsToCreate.push({
              user_id: transaction.user_id,
              activity_type: 'transaction_completed',
              title: 'Transaction complétée',
              description: `Transaction "${transaction.title}" terminée. ${transaction.price} ${transaction.currency} transférés sur votre compte.`,
              metadata: {
                transaction_id: transaction.id,
                amount: transaction.price,
                currency: transaction.currency
              }
            });
          }

          if (logsToCreate.length > 0) {
            await adminClient.from('activity_logs').insert(logsToCreate);
            logStep("Backfilled transaction_completed logs", { transactionId: transaction.id, logsCreated: logsToCreate.length });
          }
        } catch (backfillError) {
          logStep("Error backfilling transaction_completed logs", { transactionId: transaction.id, error: backfillError });
        }
      }

      logStep("Backfill completed successfully");
    } catch (backfillError) {
      logStep("Error during backfill process", { error: backfillError });
    }

    logStep("Synchronization completed", { 
      total: uncapturedPayments.length,
      synchronized: synchronizedCount,
      results: syncResults 
    });

    return new Response(JSON.stringify({ 
      success: true,
      message: `Synchronization completed: ${synchronizedCount} transactions updated`,
      synchronized: synchronizedCount,
      total: uncapturedPayments.length,
      results: syncResults
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in sync-stripe-payments", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});