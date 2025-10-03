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
  logger.log(`[UPDATE-STRIPE-ACCOUNT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !stripeSecretKey) {
      throw new Error('Missing environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-08-27.basil" });

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData.user) {
      throw new Error(`Authentication failed: ${userError?.message}`);
    }

    const userId = userData.user.id;
    logStep("User authenticated", { userId });

    // Get user's Stripe account
    const { data: stripeAccount, error: accountError } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id, account_status')
      .eq('user_id', userId)
      .maybeSingle();

    if (accountError) {
      throw new Error(`Database error: ${accountError.message}`);
    }

    if (!stripeAccount?.stripe_account_id) {
      throw new Error('No Stripe account found for user');
    }

     // Check if account still exists in Stripe
    let stripeAccountExists = true;
    try {
      await stripe.accounts.retrieve(stripeAccount.stripe_account_id);
      logStep("Stripe account verified in Stripe API");
    } catch (stripeError: any) {
      logStep("Stripe account not found in Stripe API", { error: stripeError.message });
      stripeAccountExists = false;
      
      if (stripeError.code === 'account_invalid' || stripeError.code === 'resource_missing') {
        throw new Error('No account found - account may have been deleted');
      }
      throw stripeError;
    }

    if (stripeAccount.account_status !== 'active') {
      throw new Error('Stripe account is not active. Complete setup first.');
    }

    logStep("Creating account update link", { accountId: stripeAccount.stripe_account_id });

    // Create account link (using account_onboarding for Express accounts)
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccount.stripe_account_id,
      refresh_url: `${req.headers.get('origin')}/profile`,
      return_url: `${req.headers.get('origin')}/profile`,
      type: 'account_onboarding',
    });

    logStep("Account update link created successfully", { url: accountLink.url });

    return new Response(JSON.stringify({
      success: true,
      url: accountLink.url
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logStep("ERROR", { error: errorMessage });
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});