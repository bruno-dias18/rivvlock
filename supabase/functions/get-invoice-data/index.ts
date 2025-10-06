import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { logger } from "../_shared/logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { transactionId } = await req.json();
    
    if (!transactionId) {
      return new Response(
        JSON.stringify({ error: 'Transaction ID required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Use service role client for data access
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is part of this transaction
    const { data: transaction, error: txError } = await adminClient
      .from('transactions')
      .select('user_id, buyer_id, status')
      .eq('id', transactionId)
      .single();

    if (txError || !transaction) {
      return new Response(
        JSON.stringify({ error: 'Transaction not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Check authorization: user must be seller or buyer
    if (user.id !== transaction.user_id && user.id !== transaction.buyer_id) {
      logger.error('Unauthorized invoice data access attempt:', {
        userId: user.id,
        transactionId,
        sellerId: transaction.user_id,
        buyerId: transaction.buyer_id
      });
      
      return new Response(
        JSON.stringify({ error: 'Unauthorized access' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Check if user is admin (for logging purposes)
    const { data: isAdminResult } = await supabaseClient.rpc('get_current_user_admin_status');
    const isAdmin = isAdminResult === true;

    // Use secure functions to fetch only necessary profile fields
    const { data: sellerProfile, error: sellerError } = await adminClient
      .rpc('get_seller_invoice_data', { 
        p_seller_id: transaction.user_id,
        p_requesting_user_id: user.id
      });

    if (sellerError) {
      logger.error('Error fetching seller profile:', sellerError);
    }
    
    logger.log('Seller profile data:', JSON.stringify(sellerProfile));

    // Fetch buyer profile with minimal fields using secure function
    let buyerProfile = null;
    if (transaction.buyer_id) {
      const { data, error: buyerError } = await adminClient
        .rpc('get_buyer_invoice_data', {
          p_buyer_id: transaction.buyer_id,
          p_requesting_user_id: user.id
        });

      if (buyerError) {
        logger.error('Error fetching buyer profile:', buyerError);
      }
      // RPC returns an array, get first element
      buyerProfile = data && data.length > 0 ? data[0] : null;
      logger.log('Buyer profile data:', JSON.stringify(buyerProfile));
    }

    // Log access for audit trail (with admin flag if applicable)
    const accessType = isAdmin ? 'admin_invoice_generation' : 'invoice_generation';
    await adminClient
      .from('profile_access_logs')
      .insert({
        accessed_profile_id: user.id === transaction.user_id ? transaction.buyer_id : transaction.user_id,
        accessed_by_user_id: user.id,
        access_type: accessType,
        accessed_fields: user.id === transaction.user_id 
          ? ['first_name', 'last_name', 'company_name', 'user_type', 'country', 'address', 'postal_code', 'city']
          : ['first_name', 'last_name', 'company_name', 'user_type', 'country', 'address', 'postal_code', 'city', 'siret_uid', 'vat_rate', 'tva_rate', 'is_subject_to_vat', 'avs_number', 'vat_number']
      });

    return new Response(
      JSON.stringify({ 
        success: true,
        // RPC functions return arrays, get first element
        sellerProfile: sellerProfile && sellerProfile.length > 0 ? sellerProfile[0] : null,
        buyerProfile
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logger.error('Error in get-invoice-data:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
