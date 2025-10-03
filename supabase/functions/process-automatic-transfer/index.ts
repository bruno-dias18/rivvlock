import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { logger } from "../_shared/logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  logger.log(`[AUTOMATIC-TRANSFER] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const { transaction_id } = await req.json();
    if (!transaction_id) {
      throw new Error("Transaction ID is required");
    }

    // Verify environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    
    if (!supabaseUrl || !supabaseKey || !stripeKey) {
      throw new Error("Missing required environment variables");
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      supabaseUrl,
      supabaseKey,
      { auth: { persistSession: false } }
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.id) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Get transaction details
    const { data: transaction, error: transactionError } = await supabaseClient
      .from('transactions')
      .select('*')
      .eq('id', transaction_id)
      .single();

    if (transactionError) throw new Error(`Transaction not found: ${transactionError.message}`);
    if (!transaction) throw new Error("Transaction not found");

    // Verify user is the buyer and transaction is paid
    if (transaction.buyer_id !== user.id) {
      throw new Error("Only the buyer can trigger the transfer");
    }

    if (transaction.status !== 'paid') {
      throw new Error("Transaction must be paid to transfer funds");
    }

    if (!transaction.stripe_payment_intent_id) {
      throw new Error("No Stripe payment intent found");
    }

    logStep("Transaction validated", { 
      transactionId: transaction.id, 
      sellerId: transaction.user_id,
      amount: transaction.price,
      currency: transaction.currency 
    });

    // Get seller's Stripe account
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

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2024-06-20",
    });

    // Calculate transfer amount (subtract platform fee if any)
    const platformFeePercent = 0.05; // 5% platform fee
    const originalAmount = Math.round(transaction.price * 100); // Convert to cents
    const platformFee = Math.round(originalAmount * platformFeePercent);
    const transferAmount = originalAmount - platformFee;

    logStep("Transfer amount calculated", { 
      originalAmount, 
      platformFee, 
      transferAmount 
    });

    // Get the charge ID from the payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(transaction.stripe_payment_intent_id);
    const chargeId = paymentIntent.latest_charge as string;
    
    if (!chargeId) {
      throw new Error("No charge ID found in payment intent");
    }
    
    logStep("Charge ID retrieved from payment intent", { chargeId });

    // Create transfer to connected account
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

    // Update transaction status
    const { error: updateError } = await supabaseClient
      .from('transactions')
      .update({
        status: 'validated',
        updated_at: new Date().toISOString()
      })
      .eq('id', transaction_id);

    if (updateError) {
      logStep("ERROR updating transaction status", { error: updateError.message });
      throw new Error(`Failed to update transaction: ${updateError.message}`);
    }

    // Log the activity
    await supabaseClient
      .from('activity_logs')
      .insert({
        user_id: transaction.user_id,
        activity_type: 'funds_released',
        title: 'Fonds transférés vers votre compte',
        description: `Received ${(transferAmount / 100).toFixed(2)} ${transaction.currency} for transaction: ${transaction.title}`,
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

    return new Response(JSON.stringify({
      success: true,
      transfer_id: transfer.id,
      amount_transferred: transferAmount,
      currency: transaction.currency,
      platform_fee: platformFee,
      transaction_status: 'validated'
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});