import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { 
  compose, 
  withCors, 
  withAuth, 
  withValidation,
  successResponse,
  errorResponse 
} from "../_shared/middleware.ts";
import { logger } from "../_shared/logger.ts";

const refreshStripeSchema = z.object({
  seller_id: z.string().uuid(),
});

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  logger.log(`[REFRESH-COUNTERPARTY-STRIPE-STATUS] ${step}${d}`);
};

const handler = async (ctx: any) => {
  const { user, supabaseClient, adminClient, body } = ctx;
  const { seller_id } = body;

  logStep("User authenticated", { callerId: user.id, seller_id });

  // Check counterparty relationship using the existing DB function
  const { data: relation, error: relationError } = await supabaseClient.rpc(
    "are_transaction_counterparties",
    { user_a: user.id, user_b: seller_id }
  );
  if (relationError) {
    throw new Error(`Counterparty check failed: ${relationError.message}`);
  }
  if (!relation) {
    return errorResponse("Forbidden: not a counterparty", 403);
  }
  logStep("Counterparty verified");

  // Fetch seller stripe account row
  const { data: sa, error: saErr } = await adminClient
    .from("stripe_accounts")
    .select("id, stripe_account_id, account_status, charges_enabled, payouts_enabled, onboarding_completed, last_status_check")
    .eq("user_id", seller_id)
    .maybeSingle();

  if (saErr) throw new Error(`DB error fetching stripe_accounts: ${saErr.message}`);
  if (!sa?.stripe_account_id) {
    logStep("No stripe account found or inactive", { seller_id });
    return successResponse({
      hasActiveAccount: false,
      charges_enabled: false,
      payouts_enabled: false,
      onboarding_completed: false,
    });
  }

  // Cache intelligent: Si compte actif ET vérifié < 2 min → retourner cache DB (optimisation conservatrice)
  const lastCheck = sa.last_status_check ? new Date(sa.last_status_check) : null;
  const now = new Date();
  const minutesSinceCheck = lastCheck 
    ? (now.getTime() - lastCheck.getTime()) / 60000 
    : 999;

  if (minutesSinceCheck < 2 && 
      sa.account_status === 'active' && 
      sa.charges_enabled && 
      sa.payouts_enabled && 
      sa.onboarding_completed) {
    logStep("Using cached status (checked < 2min ago, account active)", { 
      last_check: lastCheck,
      minutes_since: minutesSinceCheck.toFixed(1)
    });
    return successResponse({
      hasActiveAccount: true,
      charges_enabled: true,
      payouts_enabled: true,
      onboarding_completed: true,
    });
  }

  // Retrieve live status from Stripe
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" as any });
  let account;
  try {
    account = await stripe.accounts.retrieve(sa.stripe_account_id);
  } catch (e: any) {
    const code = e?.code || e?.raw?.code;
    const status = e?.statusCode || e?.raw?.statusCode;
    const message = String(e?.message || '');
    const isMissing = code === 'resource_missing' || status === 404 || /No such account/i.test(message);

    if (isMissing) {
      // Only mark inactive if Stripe confirms account doesn't exist
      await adminClient
        .from("stripe_accounts")
        .update({ account_status: "inactive", updated_at: new Date().toISOString() })
        .eq("id", sa.id);

      return successResponse({
        hasActiveAccount: false,
        charges_enabled: false,
        payouts_enabled: false,
        onboarding_completed: false,
      });
    }

    // Transient or auth error: do NOT downgrade; return last known DB state
    const hasActiveAccount = !!(sa.onboarding_completed && sa.charges_enabled && sa.payouts_enabled);
    return successResponse({
      hasActiveAccount,
      charges_enabled: !!sa.charges_enabled,
      payouts_enabled: !!sa.payouts_enabled,
      onboarding_completed: !!sa.onboarding_completed,
    });
  }

  const details_submitted = !!account.details_submitted;
  const charges_enabled = !!account.charges_enabled;
  const payouts_enabled = !!account.payouts_enabled;
  const onboarding_completed = details_submitted; // our DB semantics
  const hasActiveAccount = charges_enabled && payouts_enabled && onboarding_completed;
  const account_status = hasActiveAccount ? "active" : "pending";

  // Update DB with fresh values
  const { error: upErr } = await adminClient
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

  return successResponse({
    hasActiveAccount,
    charges_enabled,
    payouts_enabled,
    onboarding_completed,
  });
};

const composedHandler = compose(
  withCors,
  withAuth,
  withValidation(refreshStripeSchema)
)(handler);

serve(composedHandler);
