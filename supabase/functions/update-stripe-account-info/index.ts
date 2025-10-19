import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { 
  compose, 
  withCors, 
  withAuth, 
  successResponse,
  errorResponse 
} from "../_shared/middleware.ts";
import { logger } from "../_shared/logger.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  logger.log(`[UPDATE-STRIPE-ACCOUNT] ${step}${detailsStr}`);
};

const handler = async (ctx: any) => {
  const { user, adminClient } = ctx;
  
  try {
    logStep("Function started");

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!stripeSecretKey) {
      throw new Error('Missing environment variables');
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });

    logStep("User authenticated", { userId: user.id });

    // Get user's Stripe account
    const { data: stripeAccount, error: accountError } = await adminClient
      .from('stripe_accounts')
      .select('stripe_account_id, account_status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (accountError) {
      throw new Error(`Database error: ${accountError.message}`);
    }

    // If no Stripe account exists, create one first
    if (!stripeAccount?.stripe_account_id) {
      logStep("No Stripe account found, creating one first");
      
      // Create Stripe Connect account
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'FR',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });

      logStep("Stripe account created", { accountId: account.id });

      // Save to database
      await adminClient
        .from('stripe_accounts')
        .insert({
          user_id: user.id,
          stripe_account_id: account.id,
          account_status: 'pending',
          country: 'FR',
        });

      logStep("Account saved to database");

      // Now create onboarding link for the new account
      const accountLink = await stripe.accountLinks.create({
        account: account.id,
        refresh_url: 'https://app.rivvlock.com/dashboard/profile',
        return_url: 'https://app.rivvlock.com/dashboard/profile',
        type: 'account_onboarding',
      });

      logStep("Onboarding link created for new account", { url: accountLink.url });

      return successResponse({
        url: accountLink.url
      });
    }

     // Check if account still exists in Stripe
    let accountDetails;
    try {
      accountDetails = await stripe.accounts.retrieve(stripeAccount.stripe_account_id);
      logStep("Stripe account verified in Stripe API", { status: stripeAccount.account_status });
    } catch (stripeError: any) {
      logStep("Stripe account not found in Stripe API", { error: stripeError.message });
      
      if (stripeError.code === 'account_invalid' || stripeError.code === 'resource_missing') {
        throw new Error('No account found - account may have been deleted');
      }
      throw stripeError;
    }

    // Check if account is fully active and complete
    const isFullyActive = accountDetails.charges_enabled && 
                          accountDetails.payouts_enabled && 
                          accountDetails.details_submitted;

    if (isFullyActive) {
      // For fully active accounts, redirect to Stripe Dashboard
      const dashboardUrl = `https://dashboard.stripe.com/${stripeAccount.stripe_account_id}/settings/account`;
      
      logStep("Account is fully active, returning dashboard URL", { url: dashboardUrl });
      
      return successResponse({
        url: dashboardUrl
      });
    }

    // Determine the correct link type based on account state
    const linkType = accountDetails.details_submitted ? 'account_update' : 'account_onboarding';
    logStep("Creating account link", { 
      accountId: stripeAccount.stripe_account_id, 
      linkType,
      detailsSubmitted: accountDetails.details_submitted 
    });

    // Create account link with appropriate type
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccount.stripe_account_id,
      refresh_url: 'https://app.rivvlock.com/dashboard/profile',
      return_url: 'https://app.rivvlock.com/dashboard/profile',
      type: linkType,
    });

    logStep("Account update link created successfully", { url: accountLink.url });

    return successResponse({
      url: accountLink.url
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logStep("ERROR", { error: errorMessage });
    
    return errorResponse(errorMessage, 400);
  }
};

const composedHandler = compose(
  withCors,
  withAuth
)(handler);

serve(composedHandler);
