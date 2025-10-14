import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logger } from "../_shared/logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logger.log('🗑️ [ADMIN-DELETE-TRANSACTION] Starting deletion process');

    // User client for authentication
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Admin client for database operations
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authentication required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      throw new Error('Invalid authentication token');
    }

    // Verify user is super admin
    const { data: adminRoles } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('role', 'super_admin')
      .single();

    if (!adminRoles) {
      throw new Error('Unauthorized: Super admin access required');
    }

    logger.log('✅ [ADMIN-DELETE-TRANSACTION] Super admin verified');

    const { transactionId } = await req.json();

    if (!transactionId) {
      throw new Error('Transaction ID required');
    }

    // Get transaction details before deletion for logging
    const { data: transaction } = await adminClient
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    // Delete all related records first
    await adminClient.from('transaction_messages').delete().eq('transaction_id', transactionId);
    await adminClient.from('disputes').delete().eq('transaction_id', transactionId);
    await adminClient.from('invoices').delete().eq('transaction_id', transactionId);
    await adminClient.from('message_reads').delete().eq('message_id', transactionId);

    // Delete the transaction
    const { error: deleteError } = await adminClient
      .from('transactions')
      .delete()
      .eq('id', transactionId);

    if (deleteError) {
      logger.error('❌ [ADMIN-DELETE-TRANSACTION] Error deleting transaction:', deleteError);
      throw new Error(`Failed to delete transaction: ${deleteError.message}`);
    }

    logger.log('✅ [ADMIN-DELETE-TRANSACTION] Transaction deleted successfully');

    // Log the deletion
    await adminClient
      .from('activity_logs')
      .insert({
        user_id: userData.user.id,
        activity_type: 'admin_transaction_deleted',
        title: 'Transaction supprimée (Admin)',
        description: `Transaction "${transaction?.title}" supprimée par un administrateur`,
        metadata: {
          transaction_id: transactionId,
          deleted_transaction: transaction
        }
      });

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Transaction deleted successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    logger.error('❌ [ADMIN-DELETE-TRANSACTION] Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
