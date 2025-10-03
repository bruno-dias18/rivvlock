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
  logger.log(`[VALIDATE-STRIPE-ACCOUNTS] ${step}${detailsStr}`);
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

    // Initialize clients
    const supabaseClient = createClient(
      supabaseUrl,
      supabaseKey,
      { auth: { persistSession: false } }
    );

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2024-06-20",
    });

    // Get all Stripe accounts from database
    const { data: stripeAccounts, error: accountsError } = await supabaseClient
      .from('stripe_accounts')
      .select('*')
      .neq('account_status', 'inactive'); // Skip already inactive accounts

    if (accountsError) throw new Error(`Database error: ${accountsError.message}`);
    
    logStep("Fetched Stripe accounts from database", { count: stripeAccounts?.length || 0 });

    let validatedCount = 0;
    let inactiveCount = 0;
    let errorCount = 0;

    if (stripeAccounts && stripeAccounts.length > 0) {
      for (const dbAccount of stripeAccounts) {
        try {
          logStep("Validating account", { accountId: dbAccount.stripe_account_id });
          
          // Try to retrieve the account from Stripe
          const stripeAccount = await stripe.accounts.retrieve(dbAccount.stripe_account_id);
          
          // Update database with current status
          const { error: updateError } = await supabaseClient
            .from('stripe_accounts')
            .update({
              account_status: stripeAccount.charges_enabled && stripeAccount.payouts_enabled ? 'active' : 'pending',
              details_submitted: stripeAccount.details_submitted,
              charges_enabled: stripeAccount.charges_enabled,
              payouts_enabled: stripeAccount.payouts_enabled,
              onboarding_completed: stripeAccount.details_submitted && stripeAccount.charges_enabled,
              last_status_check: new Date().toISOString(),
            })
            .eq('id', dbAccount.id);

          if (updateError) {
            logStep("ERROR updating account status", { accountId: dbAccount.stripe_account_id, error: updateError.message });
            errorCount++;
          } else {
            validatedCount++;
            logStep("Account validated and updated", { 
              accountId: dbAccount.stripe_account_id,
              status: stripeAccount.charges_enabled && stripeAccount.payouts_enabled ? 'active' : 'pending'
            });
          }

        } catch (stripeError: any) {
          logStep("Account not found on Stripe, marking as inactive", { 
            accountId: dbAccount.stripe_account_id,
            error: stripeError.message 
          });

          // Mark account as inactive
          const { error: updateError } = await supabaseClient
            .from('stripe_accounts')
            .update({
              account_status: 'inactive',
              payouts_enabled: false,
              charges_enabled: false,
              last_status_check: new Date().toISOString(),
            })
            .eq('id', dbAccount.id);

          if (updateError) {
            logStep("ERROR marking account as inactive", { accountId: dbAccount.stripe_account_id, error: updateError.message });
            errorCount++;
          } else {
            inactiveCount++;
          }
        }
      }
    }

    logStep("Validation completed", { 
      total: stripeAccounts?.length || 0,
      validated: validatedCount,
      inactiveMarked: inactiveCount,
      errors: errorCount
    });

    return new Response(JSON.stringify({
      success: true,
      summary: {
        total_accounts: stripeAccounts?.length || 0,
        validated: validatedCount,
        marked_inactive: inactiveCount,
        errors: errorCount
      },
      message: `Validation terminée: ${validatedCount} comptes validés, ${inactiveCount} marqués comme inactifs, ${errorCount} erreurs`
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