import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[REFRESH-COUNTERPARTY-STRIPE-STATUS] ${step}${d}`);
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { seller_id } = await req.json().catch(() => ({ seller_id: null }));
    if (!seller_id) {
      return new Response(JSON.stringify({ error: "seller_id is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

    if (!supabaseUrl || !anonKey || !serviceRoleKey || !stripeKey) {
      throw new Error("Missing environment configuration for Supabase/Stripe");
    }

    // Auth client (for user verification) and admin client (for DB updates)
    const supabaseAuth = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    const callerId = userData.user.id;
    logStep("User authenticated", { callerId, seller_id });

    // Check counterparty relationship using the existing DB function
    const { data: relation, error: relationError } = await supabaseAuth.rpc(
      "are_transaction_counterparties",
      { user_a: callerId, user_b: seller_id }
    );
    if (relationError) {
      throw new Error(`Counterparty check failed: ${relationError.message}`);
    }
    if (!relation) {
      return new Response(JSON.stringify({ error: "Forbidden: not a counterparty" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }
    logStep("Counterparty verified");

    // Fetch seller stripe account row
    const { data: sa, error: saErr } = await supabaseAdmin
      .from("stripe_accounts")
      .select("id, stripe_account_id, account_status")
      .eq("user_id", seller_id)
      .neq("account_status", "inactive")
      .maybeSingle();

    if (saErr) throw new Error(`DB error fetching stripe_accounts: ${saErr.message}`);
    if (!sa?.stripe_account_id) {
      logStep("No stripe account found or inactive", { seller_id });
      return new Response(
        JSON.stringify({
          hasActiveAccount: false,
          charges_enabled: false,
          payouts_enabled: false,
          onboarding_completed: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Retrieve live status from Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" as any });
    let account;
    try {
      account = await stripe.accounts.retrieve(sa.stripe_account_id);
    } catch (e) {
      // Mark inactive if Stripe says it doesn't exist
      await supabaseAdmin
        .from("stripe_accounts")
        .update({ account_status: "inactive", updated_at: new Date().toISOString() })
        .eq("id", sa.id);

      return new Response(
        JSON.stringify({
          hasActiveAccount: false,
          charges_enabled: false,
          payouts_enabled: false,
          onboarding_completed: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const details_submitted = !!account.details_submitted;
    const charges_enabled = !!account.charges_enabled;
    const payouts_enabled = !!account.payouts_enabled;
    const onboarding_completed = details_submitted; // our DB semantics
    const hasActiveAccount = charges_enabled && payouts_enabled && onboarding_completed;
    const account_status = hasActiveAccount ? "active" : "pending";

    // Update DB with fresh values
    const { error: upErr } = await supabaseAdmin
      .from("stripe_accounts")
      .update({
        details_submitted,
        charges_enabled,
        payouts_enabled,
        onboarding_completed,
        account_status,
        last_status_check: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", sa.id);
    if (upErr) throw new Error(`DB update error: ${upErr.message}`);

    logStep("Stripe account status refreshed", { seller_id, account_status, hasActiveAccount });

    return new Response(
      JSON.stringify({
        hasActiveAccount,
        charges_enabled,
        payouts_enabled,
        onboarding_completed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});