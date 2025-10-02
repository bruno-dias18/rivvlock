import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-STRIPE-STATUS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

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
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id });

    // Get Stripe account from database
    const { data: stripeAccount, error: accountError } = await supabaseClient
      .from('stripe_accounts')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (accountError) throw new Error(`Database error: ${accountError.message}`);
    
    if (!stripeAccount) {
      logStep("No Stripe account found");
      return new Response(JSON.stringify({
        has_account: false,
        account_status: null,
        onboarding_required: true
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Initialize Stripe and fetch account details
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    logStep("Fetching Stripe account details", { accountId: stripeAccount.stripe_account_id });
    
    let account;
    try {
      account = await stripe.accounts.retrieve(stripeAccount.stripe_account_id);
      logStep("Stripe account retrieved", { 
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted 
      });
    } catch (stripeError: any) {
      logStep("ERROR - Stripe account not found", { 
        accountId: stripeAccount.stripe_account_id,
        error: stripeError.message 
      });

      // Mark account as inactive in database
      await supabaseClient
        .from('stripe_accounts')
        .update({
          account_status: 'inactive',
          payouts_enabled: false,
          charges_enabled: false,
          last_status_check: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      return new Response(JSON.stringify({
        has_account: false,
        account_status: 'inactive',
        onboarding_required: true,
        error: "Votre compte Stripe n'existe plus. Veuillez recréer votre compte."
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Update database with latest status
    const { error: updateError } = await supabaseClient
      .from('stripe_accounts')
      .update({
        account_status: account.charges_enabled && account.payouts_enabled ? 'active' : 'pending',
        details_submitted: account.details_submitted,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        onboarding_completed: account.details_submitted && account.charges_enabled,
        last_status_check: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateError) {
      logStep("ERROR updating account status", { error: updateError.message });
    } else {
      logStep("Account status updated in database");
    }

    const needsOnboarding = !account.details_submitted || !account.charges_enabled;
    let onboardingUrl = null;

    // Create onboarding link if needed
    if (needsOnboarding) {
      const origin = req.headers.get("origin") || "http://localhost:3000";
      const accountLink = await stripe.accountLinks.create({
        account: stripeAccount.stripe_account_id,
        refresh_url: `${origin}/stripe/connect?refresh=true`,
        return_url: `${origin}/stripe/connect?status=returned`,
        type: 'account_onboarding',
      });
      onboardingUrl = accountLink.url;
      logStep("Onboarding URL created", { url: onboardingUrl });
    }

    return new Response(JSON.stringify({
      has_account: true,
      stripe_account_id: stripeAccount.stripe_account_id,
      account_status: account.charges_enabled && account.payouts_enabled ? 'active' : 'pending',
      details_submitted: account.details_submitted,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      onboarding_required: needsOnboarding,
      onboarding_url: onboardingUrl
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