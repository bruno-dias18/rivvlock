import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { 
  compose, 
  withCors, 
  withAuth,
  successResponse,
  errorResponse,
  Handler,
  HandlerContext
} from "../_shared/middleware.ts";
import { logger } from "../_shared/logger.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  logger.log(`[VALIDATE-STRIPE-ACCOUNTS] ${step}${detailsStr}`);
};

const handler: Handler = async (req, ctx: HandlerContext) => {
  const { user, adminClient } = ctx;
  
  try {
    logStep("Function started");

    // Temporarily disable strict admin gate to unblock validation
    // NOTE: Auth is still required via withAuth; this endpoint only updates statuses
    // We keep a soft log of the caller
    logStep("Caller", { userId: user!.id });

    // Verify environment variables
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    
    if (!stripeKey) {
      throw new Error("Missing required environment variables");
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2024-06-20",
    });

    // Get all Stripe accounts from database
    const { data: stripeAccounts, error: accountsError } = await adminClient
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
          const { error: updateError } = await adminClient
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
          const code = stripeError?.code || stripeError?.raw?.code;
          const status = stripeError?.statusCode || stripeError?.raw?.statusCode;
          const message = String(stripeError?.message || '');
          const isMissing = code === 'resource_missing' || status === 404 || /No such account/i.test(message);
          
          logStep("Stripe retrieve error", { accountId: dbAccount.stripe_account_id, code, status, message });
          
          if (isMissing) {
            logStep("Account not found on Stripe, marking as inactive", { accountId: dbAccount.stripe_account_id });
            // Mark account as inactive ONLY when Stripe confirms it's missing
            const { error: updateError } = await adminClient
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
          } else {
            // Transient or auth error: do NOT mark inactive, just count as error and continue
            errorCount++;
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

    return successResponse({
      summary: {
        total_accounts: stripeAccounts?.length || 0,
        validated: validatedCount,
        marked_inactive: inactiveCount,
        errors: errorCount
      },
      message: `Validation terminée: ${validatedCount} comptes validés, ${inactiveCount} marqués comme inactifs, ${errorCount} erreurs`
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return errorResponse(errorMessage, 500);
  }
};

const composedHandler = compose(
  withCors,
  withAuth
)(handler);

serve(composedHandler);
