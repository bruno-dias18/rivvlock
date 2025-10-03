import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { logger } from "../_shared/logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Authenticate the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401
        }
      );
    }

    // Create authenticated client to verify the user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      logger.error('Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401
        }
      );
    }

    const { sellerUserId, buyerUserId } = await req.json();

    // Check if user is admin
    const { data: isAdmin } = await supabaseClient.rpc('check_admin_role', { 
      _user_id: user.id 
    });

    // Check if user is a transaction participant
    let isAuthorized = isAdmin;
    if (!isAuthorized && sellerUserId && buyerUserId) {
      const { data: isCounterparty } = await supabaseClient.rpc('are_transaction_counterparties', {
        user_a: user.id,
        user_b: sellerUserId
      });
      const { data: isCounterparty2 } = await supabaseClient.rpc('are_transaction_counterparties', {
        user_a: user.id,
        user_b: buyerUserId
      });
      isAuthorized = isCounterparty || isCounterparty2;
    }

    if (!isAuthorized) {
      logger.error('Unauthorized access attempt', { userId: user.id, sellerUserId, buyerUserId });
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403
        }
      );
    }

    // Use service role client for admin operations
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get seller email
    let sellerEmail = null;
    if (sellerUserId) {
      const { data: sellerData } = await adminClient.auth.admin.getUserById(sellerUserId);
      sellerEmail = sellerData.user?.email;
      
      // Log access for audit
      await adminClient.from('profile_access_logs').insert({
        accessed_profile_id: sellerUserId,
        accessed_by_user_id: user.id,
        access_type: 'email_access',
        accessed_fields: ['email']
      });
    }

    // Get buyer email  
    let buyerEmail = null;
    if (buyerUserId) {
      const { data: buyerData } = await adminClient.auth.admin.getUserById(buyerUserId);
      buyerEmail = buyerData.user?.email;
      
      // Log access for audit
      await adminClient.from('profile_access_logs').insert({
        accessed_profile_id: buyerUserId,
        accessed_by_user_id: user.id,
        access_type: 'email_access',
        accessed_fields: ['email']
      });
    }

    logger.info('Email access granted', { userId: user.id, isAdmin });

    return new Response(
      JSON.stringify({ 
        sellerEmail,
        buyerEmail 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    logger.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
})