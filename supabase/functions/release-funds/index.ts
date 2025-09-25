import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[RELEASE-FUNDS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.id) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const { transactionId } = await req.json();
    if (!transactionId) throw new Error("Transaction ID is required");
    logStep("Request data parsed", { transactionId });

    // Get transaction details
    const { data: transaction, error: transactionError } = await supabaseClient
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .eq("buyer_id", user.id) // Only buyer can release funds
      .eq("status", "paid")
      .single();

    if (transactionError || !transaction) {
      throw new Error("Transaction not found or not authorized");
    }
    logStep("Transaction found", { transactionId, sellerId: transaction.user_id });

    if (!transaction.stripe_payment_intent_id) {
      throw new Error("No Stripe payment intent found for this transaction");
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Get seller's Stripe account details
    const { data: sellerStripeAccount, error: accountError } = await supabaseClient
      .from('stripe_accounts')
      .select('*')
      .eq('user_id', transaction.user_id)
      .single();

    if (accountError || !sellerStripeAccount) {
      throw new Error("Seller does not have a configured Stripe account");
    }

    if (!sellerStripeAccount.payouts_enabled || !sellerStripeAccount.charges_enabled) {
      throw new Error("Seller's Stripe account is not ready for transfers");
    }

    logStep("Seller Stripe account validated", { 
      accountId: sellerStripeAccount.stripe_account_id,
      payoutsEnabled: sellerStripeAccount.payouts_enabled 
    });

    // Capture the payment intent to release funds to seller
    const paymentIntent = await stripe.paymentIntents.capture(
      transaction.stripe_payment_intent_id
    );
    logStep("Payment intent captured", { paymentIntentId: paymentIntent.id });

    // Get the charge ID from the payment intent for the transfer
    const chargeId = paymentIntent.latest_charge as string;
    if (!chargeId) {
      throw new Error("No charge ID found in payment intent");
    }
    logStep("Charge ID retrieved", { chargeId });

    // Calculate transfer amount (subtract platform fee)
    const platformFeePercent = 0.05; // 5% platform fee
    const originalAmount = Math.round(transaction.price * 100); // Convert to cents
    const platformFee = Math.round(originalAmount * platformFeePercent);
    const transferAmount = originalAmount - platformFee;

    logStep("Transfer amount calculated", { 
      originalAmount, 
      platformFee, 
      transferAmount 
    });

    // Create transfer to connected account using charge ID
    const transfer = await stripe.transfers.create({
      amount: transferAmount,
      currency: transaction.currency.toLowerCase(),
      destination: sellerStripeAccount.stripe_account_id,
      source_transaction: chargeId,
      description: `Transfer for transaction: ${transaction.title}`,
      metadata: {
        transaction_id: transaction.id,
        seller_id: transaction.user_id,
        buyer_id: transaction.buyer_id
      }
    });

    logStep("Transfer created", { transferId: transfer.id });

    // Update transaction status to validated
    const { error: updateError } = await supabaseClient
      .from("transactions")
      .update({
        status: "validated",
        updated_at: new Date().toISOString(),
      })
      .eq("id", transactionId);

    if (updateError) {
      throw new Error(`Failed to update transaction: ${updateError.message}`);
    }
    logStep("Transaction updated to validated");

    // Log the activity for seller
    await supabaseClient
      .from('activity_logs')
      .insert({
        user_id: transaction.user_id,
        activity_type: 'funds_released',
        title: 'Fonds transférés vers votre compte',
        description: `${(transferAmount / 100).toFixed(2)} ${transaction.currency} reçus pour la transaction "${transaction.title}"`,
        metadata: {
          transaction_id: transaction.id,
          transfer_id: transfer.id,
          amount: transferAmount,
          currency: transaction.currency,
          platform_fee: platformFee
        }
      });

    // Log for buyer as well
    await supabaseClient
      .from('activity_logs')
      .insert({
        user_id: transaction.buyer_id,
        activity_type: 'transaction_completed',
        title: 'Transaction terminée',
        description: `Fonds transférés au vendeur pour "${transaction.title}"`,
        metadata: {
          transaction_id: transaction.id,
          transfer_id: transfer.id,
          amount: transferAmount,
          currency: transaction.currency
        }
      });

    logStep("Activity logs created");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Funds released and transferred successfully",
        transactionId,
        transferId: transfer.id,
        amountTransferred: transferAmount,
        currency: transaction.currency,
        platformFee: platformFee
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});