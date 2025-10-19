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
  const { user, supabaseClient } = ctx;

  logger.log('Exporting data for user:', user!.id);

  // Collect all user data
  const exportData: any = {
    export_date: new Date().toISOString(),
    user_id: user!.id,
    email: user!.email,
  };

  // 1. Profile data
  const { data: profile } = await supabaseClient!
    .from('profiles')
    .select('*')
    .eq('user_id', user!.id)
    .single();
  
  if (profile) {
    exportData.profile = profile;
  }

  // 2. Transactions (seller or buyer)
  const { data: transactions } = await supabaseClient!
    .from('transactions')
    .select('*')
    .or(`user_id.eq.${user!.id},buyer_id.eq.${user!.id}`);
  
  if (transactions) {
    exportData.transactions = transactions;
  }

  // 3. Transaction messages
  const { data: messages } = await supabaseClient!
    .from('transaction_messages')
    .select('*')
    .eq('sender_id', user!.id);
  
  if (messages) {
    exportData.transaction_messages = messages;
  }

  // 4. Disputes
  const { data: disputes } = await supabaseClient!
    .from('disputes')
    .select('*')
    .eq('reporter_id', user!.id);
  
  if (disputes) {
    exportData.disputes = disputes;
  }

  // 5. Dispute messages
  const { data: disputeMessages } = await supabaseClient!
    .from('dispute_messages')
    .select('*')
    .eq('sender_id', user!.id);
  
  if (disputeMessages) {
    exportData.dispute_messages = disputeMessages;
  }

  // 6. Stripe account info (non-sensitive)
  const { data: stripeAccount } = await supabaseClient!
    .from('stripe_accounts')
    .select('account_status, onboarding_completed, charges_enabled, payouts_enabled, created_at')
    .eq('user_id', user!.id)
    .single();
  
  if (stripeAccount) {
    exportData.stripe_account = stripeAccount;
  }

  // 7. Activity logs (last 90 days)
  const { data: activityLogs } = await supabaseClient!
    .from('activity_logs')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(100);
  
  if (activityLogs) {
    exportData.activity_logs = activityLogs;
  }

  // 8. Invoices
  const { data: invoices } = await supabaseClient!
    .from('invoices')
    .select('*')
    .or(`seller_id.eq.${user!.id},buyer_id.eq.${user!.id}`);
  
  if (invoices) {
    exportData.invoices = invoices;
  }

  logger.log('Data export completed for user:', user!.id);

  return new Response(
    JSON.stringify(exportData, null, 2), 
    { 
      status: 200,
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="rivvlock-data-export-${user!.id}.json"`
      }
    }
  );
};

const composedHandler = compose(
  withCors,
  withAuth
)(handler);

Deno.serve(composedHandler);
