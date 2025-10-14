import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { logger } from "../_shared/logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  logger.log(`[PROCESS-VALIDATION-DEADLINE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("🕐 Starting deadline processing");

    // Find transactions where validation deadline has passed and funds not released
    const { data: expiredTransactions, error: fetchError } = await adminClient
      .from("transactions")
      .select("*")
      .eq("buyer_validated", false)
      .eq("funds_released", false)
      .not("validation_deadline", "is", null)
      .lt("validation_deadline", new Date().toISOString())
      .eq("status", "paid");

    if (fetchError) {
      logStep("❌ Error fetching expired transactions", fetchError);
      throw new Error("Failed to fetch expired transactions");
    }

    if (!expiredTransactions || expiredTransactions.length === 0) {
      logStep("ℹ️ No expired transactions found");
      return new Response(JSON.stringify({
        success: true,
        processed: 0,
        message: "No expired transactions to process"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep(`📋 Found ${expiredTransactions.length} expired transactions`);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-06-20",
    });

    let processedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (const transaction of expiredTransactions) {
      try {
        logStep(`💰 Processing transaction ${transaction.id}`, { 
          sellerId: transaction.user_id,
          amount: transaction.price 
        });

        if (!transaction.stripe_payment_intent_id) {
          logStep(`❌ No payment intent for transaction ${transaction.id}`);
          errorCount++;
          continue;
        }

        // Get seller's Stripe account
        const { data: sellerStripeAccount, error: accountError } = await adminClient
          .from('stripe_accounts')
          .select('*')
          .eq('user_id', transaction.user_id)
          .single();

        if (accountError || !sellerStripeAccount) {
          logStep(`⚠️ Seller has no Stripe account`, { 
            transactionId: transaction.id, 
            sellerId: transaction.user_id 
          });
          skippedCount++;
          continue;
        }

        // LIVE verification on Stripe to ensure account is truly active
        let isSellerAccountActive = false;
        try {
          const stripeAccount = await stripe.accounts.retrieve(sellerStripeAccount.stripe_account_id);
          logStep("✅ Stripe account validated live", { 
            accountId: sellerStripeAccount.stripe_account_id,
            payoutsEnabled: stripeAccount.payouts_enabled,
            chargesEnabled: stripeAccount.charges_enabled
          });

          isSellerAccountActive = !!(stripeAccount.payouts_enabled && stripeAccount.charges_enabled);

          // Update database with live status
          await adminClient
            .from('stripe_accounts')
            .update({
              account_status: isSellerAccountActive ? 'active' : 'pending',
              payouts_enabled: stripeAccount.payouts_enabled || false,
              charges_enabled: stripeAccount.charges_enabled || false,
              last_status_check: new Date().toISOString(),
            })
            .eq('user_id', transaction.user_id);

        } catch (stripeError: any) {
          const code = stripeError?.code || stripeError?.raw?.code;
          const status = stripeError?.statusCode || stripeError?.raw?.statusCode;
          const message = String(stripeError?.message || '');
          const isMissing = code === 'resource_missing' || status === 404 || /No such account/i.test(message);
          
          logStep("⚠️ Stripe account validation failed", { 
            accountId: sellerStripeAccount.stripe_account_id,
            code,
            status,
            message
          });

          // Only mark inactive if account truly doesn't exist
          if (isMissing) {
            await adminClient
              .from('stripe_accounts')
              .update({
                account_status: 'inactive',
                payouts_enabled: false,
                charges_enabled: false,
                last_status_check: new Date().toISOString(),
              })
              .eq('user_id', transaction.user_id);
            
            isSellerAccountActive = false;
          } else {
            // Transient error: assume account is still valid, skip this transaction
            logStep(`⏭️ SKIPPED - Transient Stripe API error, assuming account valid`, { 
              transactionId: transaction.id 
            });
            skippedCount++;
            continue;
          }
        }

        // Skip if seller account is not active
        if (!isSellerAccountActive) {
          logStep(`⏭️ SKIPPED - Seller Stripe account inactive`, { 
            transactionId: transaction.id,
            sellerId: transaction.user_id 
          });
          skippedCount++;
          continue;
        }

        // Retrieve payment intent to check status
        let paymentIntent = await stripe.paymentIntents.retrieve(
          transaction.stripe_payment_intent_id
        );
        logStep("Payment intent retrieved", { 
          paymentIntentId: paymentIntent.id, 
          status: paymentIntent.status 
        });

        // Capture if needed
        if (paymentIntent.status === 'requires_capture') {
          paymentIntent = await stripe.paymentIntents.capture(
            transaction.stripe_payment_intent_id
          );
          logStep("Payment intent captured", { paymentIntentId: paymentIntent.id });
        } else if (paymentIntent.status === 'succeeded') {
          logStep("Payment intent already succeeded");
        } else {
          logStep(`⚠️ Payment intent status invalid for release: ${paymentIntent.status}`);
          errorCount++;
          continue;
        }

        // Get charge ID for transfer
        const chargeId = paymentIntent.latest_charge as string;
        if (!chargeId) {
          logStep("❌ No charge ID found in payment intent");
          errorCount++;
          continue;
        }

        // Calculate transfer amount
        const platformFeePercent = 0.05;
        const originalAmount = Math.round(transaction.price * 100);
        const platformFee = Math.round(originalAmount * platformFeePercent);
        const transferAmount = originalAmount - platformFee;

        logStep("Transfer amount calculated", { 
          originalAmount, 
          platformFee, 
          transferAmount 
        });

        // Create transfer to seller's connected account
        const transfer = await stripe.transfers.create({
          amount: transferAmount,
          currency: transaction.currency.toLowerCase(),
          destination: sellerStripeAccount.stripe_account_id,
          source_transaction: chargeId,
          description: `Automatic transfer - validation deadline expired: ${transaction.title}`,
          metadata: {
            transaction_id: transaction.id,
            seller_id: transaction.user_id,
            buyer_id: transaction.buyer_id,
            auto_released: 'true'
          }
        });

        logStep("✅ Transfer created", { transferId: transfer.id });

        // Update transaction to validated and mark funds released
        const { error: updateError } = await adminClient
          .from("transactions")
          .update({
            status: "validated",
            funds_released: true,
            buyer_validated: true, // Auto-validate since deadline passed
            funds_released_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq("id", transaction.id);

        if (updateError) {
          logStep(`❌ Error updating transaction ${transaction.id}`, updateError);
          errorCount++;
          continue;
        }

        logStep("Transaction updated to validated");

        // Generate invoice if it doesn't exist yet
        const { data: existingInvoice } = await adminClient
          .from('invoices')
          .select('id')
          .eq('transaction_id', transaction.id)
          .maybeSingle();

        if (!existingInvoice) {
          logStep("Generating invoice for validated transaction");
          try {
            const { data: invoiceData, error: invoiceError } = await adminClient.functions.invoke(
              'generate-invoice-number',
              {
                body: {
                  transactionId: transaction.id,
                  sellerId: transaction.user_id,
                  amount: transaction.price,
                  currency: transaction.currency
                }
              }
            );

            if (!invoiceError && invoiceData?.invoiceNumber) {
              logStep("Invoice generated", { invoiceNumber: invoiceData.invoiceNumber });
            } else {
              logger.error("Failed to generate invoice:", invoiceError);
            }
          } catch (invoiceErr) {
            logger.error("Error generating invoice:", invoiceErr);
          }
        }

        // Log activity for seller
        await adminClient
          .from('activity_logs')
          .insert({
            user_id: transaction.user_id,
            activity_type: 'funds_released',
            title: 'Fonds transférés automatiquement',
            description: `${(transferAmount / 100).toFixed(2)} ${transaction.currency} reçus pour "${transaction.title}" (délai de validation expiré)`,
            metadata: {
              transaction_id: transaction.id,
              transfer_id: transfer.id,
              amount: transferAmount,
              currency: transaction.currency,
              platform_fee: platformFee,
              auto_released: true
            }
          });

        // Log activity for buyer
        await adminClient
          .from('activity_logs')
          .insert({
            user_id: transaction.buyer_id,
            activity_type: 'transaction_completed',
            title: 'Transaction validée automatiquement',
            description: `Délai de validation expiré, fonds transférés au vendeur pour "${transaction.title}"`,
            metadata: {
              transaction_id: transaction.id,
              transfer_id: transfer.id,
              amount: transferAmount,
              currency: transaction.currency,
              auto_released: true
            }
          });

        logStep("✅ Successfully processed transaction", { 
          transactionId: transaction.id,
          transferId: transfer.id 
        });
        processedCount++;

      } catch (error) {
        logStep(`❌ Error processing transaction ${transaction.id}`, error);
        errorCount++;
      }
    }

    logStep(`🏁 Processing complete`, { 
      processed: processedCount,
      skipped: skippedCount,
      errors: errorCount,
      total: expiredTransactions.length 
    });

    return new Response(JSON.stringify({ 
      success: true,
      processed: processedCount,
      skipped: skippedCount,
      errors: errorCount,
      total: expiredTransactions.length
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    logStep("❌ Function error", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});