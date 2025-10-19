import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'
import Stripe from 'https://esm.sh/stripe@17.1.0'
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

const handler: Handler = async (req, ctx: HandlerContext) => {
  const { user, supabaseClient, adminClient } = ctx;

  logger.log('Deleting account for user:', user!.id);

  // Initialize Stripe
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
    apiVersion: '2024-06-20'
  });

  // Check for active transactions (detailed)
  const { data: activeTransactions, error: transactionsError } = await supabaseClient!
    .from('transactions')
    .select('id, status')
    .or(`user_id.eq.${user!.id},buyer_id.eq.${user!.id}`)
    .in('status', ['pending', 'paid']);

  if (transactionsError) {
    logger.error('Error checking transactions:', transactionsError);
    return errorResponse('Error checking transactions', 500);
  }

  // Check for active disputes
  const { data: activeDisputes, error: disputesError } = await supabaseClient!
    .from('disputes')
    .select('id, status')
    .eq('reporter_id', user!.id)
    .in('status', ['open', 'responded', 'negotiating', 'escalated']);

  if (disputesError) {
    logger.error('Error checking disputes:', disputesError);
  }

  const activeDisputesCount = activeDisputes?.length || 0;

  // Block deletion if active transactions or disputes exist
  if (activeTransactions && activeTransactions.length > 0) {
    const pendingCount = activeTransactions.filter(t => t.status === 'pending').length;
    const paidCount = activeTransactions.filter(t => t.status === 'paid').length;

    logger.log(`Account deletion blocked: ${activeTransactions.length} active transactions, ${activeDisputesCount} disputes`);

    return errorResponse(
      'Cannot delete account with active transactions',
      400,
      {
        message: `You have ${activeTransactions.length} active transaction(s)`,
        activeTransactionsCount: activeTransactions.length,
        activeDisputesCount: activeDisputesCount,
        details: {
          pending: pendingCount,
          paid: paidCount,
          disputes: activeDisputesCount
        }
      }
    );
  }

  // Block if active disputes exist (even without transactions)
  if (activeDisputesCount > 0) {
    logger.log(`Account deletion blocked: ${activeDisputesCount} active disputes`);

    return errorResponse(
      'Cannot delete account with active disputes',
      400,
      {
        message: `You have ${activeDisputesCount} active dispute(s)`,
        activeTransactionsCount: 0,
        activeDisputesCount: activeDisputesCount,
        details: {
          pending: 0,
          paid: 0,
          disputes: activeDisputesCount
        }
      }
    );
  }

  // Start deletion process
  logger.log('Starting account deletion process...');

  // 1. Delete Stripe accounts
  const { data: stripeAccounts } = await supabaseClient!
    .from('stripe_accounts')
    .select('stripe_account_id')
    .eq('user_id', user!.id);

  if (stripeAccounts) {
    for (const account of stripeAccounts) {
      try {
        await stripe.accounts.del(account.stripe_account_id);
        logger.log('Deleted Stripe account:', account.stripe_account_id);
      } catch (error) {
        logger.warn('Failed to delete Stripe account:', error);
      }
    }
  }

  // 2. Anonymize transactions (keep for history but remove personal data)
  const { error: anonymizeError } = await supabaseClient!
    .from('transactions')
    .update({
      seller_display_name: 'Utilisateur supprimé',
      buyer_display_name: 'Utilisateur supprimé'
    })
    .or(`user_id.eq.${user!.id},buyer_id.eq.${user!.id}`);

  if (anonymizeError) {
    logger.warn('Error anonymizing transactions:', anonymizeError);
  }

  // 3. Delete related data (use admin client to bypass RLS)
  const tablesToClean = [
    'stripe_accounts',
    'activity_logs', 
    'admin_roles',
    'user_roles',
    'profiles'
  ];

  for (const table of tablesToClean) {
    const { error } = await adminClient!
      .from(table)
      .delete()
      .eq('user_id', user!.id);
    
    if (error) {
      logger.warn(`Error deleting from ${table}:`, error);
    } else {
      logger.log(`Cleaned ${table} for user ${user!.id}`);
    }
  }

  // 4. Delete user from auth (this will cascade to remaining references)
  const { error: deleteUserError } = await adminClient!.auth.admin.deleteUser(user!.id);

  if (deleteUserError) {
    logger.error('Error deleting user:', deleteUserError);
    return errorResponse('Error deleting user account', 500);
  }

  logger.log('User account deleted successfully:', user!.id);

  return successResponse({ 
    success: true, 
    message: 'Account deleted successfully' 
  });
};

const composedHandler = compose(
  withCors,
  withAuth
)(handler);

Deno.serve(composedHandler);
