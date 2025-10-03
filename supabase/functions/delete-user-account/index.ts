import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'
import Stripe from 'https://esm.sh/stripe@17.1.0'
import { logger } from "../_shared/logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase clients
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        }
      }
    );

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        }
      }
    );

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2024-06-20'
    });

    // Get user from JWT token
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      logger.error('Authentication failed:', userError);
      return new Response(
        JSON.stringify({ error: 'User not authenticated' }), 
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    logger.log('Deleting account for user:', user.id);

    // Check for active transactions
    const { data: activeTransactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('id, status')
      .or(`user_id.eq.${user.id},buyer_id.eq.${user.id}`)
      .in('status', ['pending', 'paid']);

    if (transactionsError) {
      logger.error('Error checking transactions:', transactionsError);
      return new Response(
        JSON.stringify({ error: 'Error checking transactions' }), 
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (activeTransactions && activeTransactions.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Cannot delete account with active transactions' }), 
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Start deletion process
    logger.log('Starting account deletion process...');

    // 1. Delete Stripe accounts
    const { data: stripeAccounts } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id')
      .eq('user_id', user.id);

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
    const { error: anonymizeError } = await supabase
      .from('transactions')
      .update({
        seller_display_name: 'Utilisateur supprimé',
        buyer_display_name: 'Utilisateur supprimé'
      })
      .or(`user_id.eq.${user.id},buyer_id.eq.${user.id}`);

    if (anonymizeError) {
      logger.warn('Error anonymizing transactions:', anonymizeError);
    }

    // 3. Delete related data
    const tablesToClean = [
      'stripe_accounts',
      'activity_logs', 
      'admin_roles',
      'profiles'
    ];

    for (const table of tablesToClean) {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('user_id', user.id);
      
      if (error) {
        logger.warn(`Error deleting from ${table}:`, error);
      } else {
        logger.log(`Cleaned ${table} for user ${user.id}`);
      }
    }

    // 4. Delete user from auth (this will cascade to remaining references)
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

    if (deleteUserError) {
      logger.error('Error deleting user:', deleteUserError);
      return new Response(
        JSON.stringify({ error: 'Error deleting user account' }), 
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    logger.log('User account deleted successfully:', user.id);

    return new Response(
      JSON.stringify({ success: true, message: 'Account deleted successfully' }), 
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    logger.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }), 
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
