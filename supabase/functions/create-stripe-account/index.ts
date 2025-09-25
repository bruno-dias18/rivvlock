import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-STRIPE-ACCOUNT] ${step}${detailsStr}`);
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
      logStep("ERROR - Missing environment variables", { 
        hasSupabaseUrl: !!supabaseUrl, 
        hasSupabaseKey: !!supabaseKey, 
        hasStripeKey: !!stripeKey 
      });
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
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Get user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (profileError) throw new Error(`Profile not found: ${profileError.message}`);
    logStep("Profile found", { userType: profile.user_type, country: profile.country });

    // Eligibility: allow both business and individual accounts
    logStep("Eligibility check passed", { userType: profile.user_type });

    // Check if Stripe account already exists
    const { data: existingAccount } = await supabaseClient
      .from('stripe_accounts')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (existingAccount) {
      logStep("Existing Stripe account found", { accountId: existingAccount.stripe_account_id });
      return new Response(JSON.stringify({
        stripe_account_id: existingAccount.stripe_account_id,
        account_status: existingAccount.account_status,
        existing: true
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2024-06-20",
    });

    // Create Stripe Connect account
    const accountData: any = {
      type: 'express',
      country: profile.country,
      email: user.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: profile.user_type === 'business' ? 'company' : 'individual',
    };

    // Add business profile if company
    if (profile.user_type === 'business' && profile.company_name) {
      accountData.business_profile = {
        name: profile.company_name,
        support_email: user.email,
      };
      accountData.company = {
        name: profile.company_name,
        address: profile.company_address ? {
          line1: profile.company_address,
          country: profile.country,
        } : undefined,
      };
    }

    // Add individual info
    if (profile.first_name || profile.last_name) {
      accountData.individual = {
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: user.email,
        address: profile.address ? {
          line1: profile.address,
          country: profile.country,
        } : undefined,
      };
    }

    logStep("Creating Stripe account", { accountData });
    const account = await stripe.accounts.create(accountData);
    logStep("Stripe account created", { accountId: account.id });

    // Store in database
    const { error: insertError } = await supabaseClient
      .from('stripe_accounts')
      .insert({
        user_id: user.id,
        stripe_account_id: account.id,
        country: profile.country,
        account_status: 'pending',
        details_submitted: false,
        charges_enabled: false,
        payouts_enabled: false,
      });

    if (insertError) throw new Error(`Database insert error: ${insertError.message}`);
    logStep("Account stored in database");

    // Log security event
    await supabaseClient.rpc('log_security_event', {
      event_type: 'STRIPE_ACCOUNT_CREATED',
      details: { stripe_account_id: account.id, user_type: profile.user_type }
    });

    // Create an account onboarding link
    const origin = req.headers.get("origin") || "http://localhost:3000";
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${origin}/stripe/connect?refresh=true`,
      return_url: `${origin}/stripe/connect?status=returned`,
      type: 'account_onboarding',
    });

    return new Response(JSON.stringify({
      stripe_account_id: account.id,
      account_status: 'pending',
      onboarding_url: accountLink.url,
      existing: false
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