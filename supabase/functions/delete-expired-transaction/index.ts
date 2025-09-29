import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteTransactionRequest {
  transactionId: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth header
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('[DELETE-TRANSACTION] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Parse request body
    const { transactionId }: DeleteTransactionRequest = await req.json();

    if (!transactionId) {
      return new Response(
        JSON.stringify({ error: 'Transaction ID is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[DELETE-TRANSACTION] User ${user.email} requesting to delete transaction ${transactionId}`);

    // First, verify the transaction exists and user has permission
    const { data: transaction, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (fetchError || !transaction) {
      console.error('[DELETE-TRANSACTION] Transaction not found:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Transaction not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Verify user is participant (seller or buyer)
    if (transaction.user_id !== user.id && transaction.buyer_id !== user.id) {
      console.error('[DELETE-TRANSACTION] User not authorized for transaction:', {
        userId: user.id,
        sellerId: transaction.user_id,
        buyerId: transaction.buyer_id
      });
      return new Response(
        JSON.stringify({ error: 'Not authorized to delete this transaction' }),
        { status: 403, headers: corsHeaders }
      );
    }

    // Verify transaction is expired
    if (transaction.status !== 'expired') {
      console.error('[DELETE-TRANSACTION] Transaction is not expired:', transaction.status);
      return new Response(
        JSON.stringify({ error: 'Only expired transactions can be deleted' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Delete the transaction
    const { error: deleteError } = await supabase
      .from('transactions')
      .delete()
      .eq('id', transactionId);

    if (deleteError) {
      console.error('[DELETE-TRANSACTION] Delete error:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete transaction' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Log the deletion activity
    await supabase
      .from('activity_logs')
      .insert({
        user_id: user.id,
        activity_type: 'transaction_deleted',
        title: 'Transaction supprimée',
        description: `Transaction expirée "${transaction.title}" supprimée`,
        metadata: {
          transaction_id: transactionId,
          transaction_title: transaction.title,
          deleted_by: user.id,
          deleted_at: new Date().toISOString()
        }
      });

    console.log(`[DELETE-TRANSACTION] Successfully deleted transaction ${transactionId} by user ${user.email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Transaction deleted successfully' 
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('[DELETE-TRANSACTION] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});