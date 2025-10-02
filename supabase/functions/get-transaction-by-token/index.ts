import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 [GET-TX-BY-TOKEN] Starting transaction fetch');

    // Use anon key for anonymous access via RLS policy
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error('❌ [GET-TX-BY-TOKEN] Missing env variables');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Configuration serveur incomplète',
          reason: 'env_missing'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Create clients
    const supabaseClient = createClient(supabaseUrl, anonKey);
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Extract IP and User-Agent for abuse detection
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                      req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token manquant', reason: 'missing_token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate token format (basic UUID check)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token)) {
      // Log invalid format attempt
      await adminClient
        .from('transaction_access_attempts')
        .insert({
          token,
          ip_address: ipAddress,
          user_agent: userAgent,
          success: false,
          error_reason: 'invalid_token_format'
        });
      
      return new Response(
        JSON.stringify({ success: false, error: 'Format de token invalide', reason: 'invalid_token_format' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Check for abuse patterns (brute-force detection)
    const { data: abuseCheck } = await supabaseClient
      .rpc('check_token_abuse', { 
        check_token: token, 
        check_ip: ipAddress 
      })
      .single();

    if (abuseCheck?.is_suspicious) {
      console.warn('⚠️ [GET-TX-BY-TOKEN] Suspicious activity detected', { 
        token, 
        ipAddress, 
        reason: abuseCheck.reason,
        attempts: abuseCheck.attempts_last_hour
      });
      
      // Log the blocked attempt
      await adminClient
        .from('transaction_access_attempts')
        .insert({
          token,
          ip_address: ipAddress,
          user_agent: userAgent,
          success: false,
          error_reason: 'rate_limit_exceeded'
        });

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Trop de tentatives. Veuillez réessayer plus tard.', 
          reason: 'rate_limit_exceeded' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
      );
    }

    console.log('🔍 [GET-TX-BY-TOKEN] Fetching transaction with token:', token);

// Try by shared_link_token using RLS policy (secure anonymous access)
let transaction: any = null;
let lookupMethod: 'shared_link_token' | 'id' | 'none' = 'none';

const { data: txByToken, error: errByToken } = await supabaseClient
  .from('transactions')
  .select(`
    id,
    title,
    description,
    price,
    currency,
    service_date,
    status,
    user_id,
    buyer_id,
    payment_deadline,
    created_at,
    updated_at,
    payment_method,
    stripe_payment_intent_id,
    seller_display_name,
    buyer_display_name,
    shared_link_token,
    shared_link_expires_at
  `)
  .eq('shared_link_token', token)
  .maybeSingle();

if (txByToken) {
  transaction = txByToken;
  lookupMethod = 'shared_link_token';
  console.log('✅ [GET-TX-BY-TOKEN] Found by shared_link_token:', transaction.id);
} else {
  console.error('❌ [GET-TX-BY-TOKEN] Transaction not found by token', { errByToken });
  
  // Log failed access attempt
  await adminClient
    .from('transaction_access_attempts')
    .insert({
      token,
      ip_address: ipAddress,
      user_agent: userAgent,
      success: false,
      error_reason: 'transaction_not_found'
    });
  
  return new Response(
    JSON.stringify({ 
      success: false, 
      error: 'Transaction non trouvée, token invalide ou expiré', 
      reason: 'not_found' 
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
  );
}


    console.log('✅ [GET-TX-BY-TOKEN] Transaction found:', transaction.id);

    // Log successful access
    await adminClient
      .from('transaction_access_attempts')
      .insert({
        token,
        ip_address: ipAddress,
        user_agent: userAgent,
        success: true,
        transaction_id: transaction.id
      });

    // Fetch seller profile and email
    let sellerProfile = null;
    if (transaction.user_id) {
      const { data: profileData } = await adminClient
        .from('profiles')
        .select('first_name, last_name, company_name, user_type')
        .eq('user_id', transaction.user_id)
        .maybeSingle();
      
      const { data: userData } = await adminClient
        .auth.admin.getUserById(transaction.user_id);
        
      if (profileData && userData.user) {
        sellerProfile = {
          ...profileData,
          email: userData.user.email
        };
      }
    }

    // Fetch buyer profile and email if buyer exists
    let buyerProfile = null;
    if (transaction.buyer_id) {
      const { data: profileData } = await adminClient
        .from('profiles')
        .select('first_name, last_name, company_name, user_type')
        .eq('user_id', transaction.buyer_id)
        .maybeSingle();
        
      const { data: userData } = await adminClient
        .auth.admin.getUserById(transaction.buyer_id);
        
      if (profileData && userData.user) {
        buyerProfile = {
          ...profileData,
          email: userData.user.email
        };
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        transaction: transaction,
        seller_profile: sellerProfile,
        buyer_profile: buyerProfile
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ [GET-TX-BY-TOKEN] Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        reason: 'internal_error',
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});