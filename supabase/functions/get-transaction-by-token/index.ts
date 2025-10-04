import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { logger } from "../_shared/logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// Security: Mask sensitive tokens in logs
function maskToken(token: string): string {
  if (!token || token.length < 12) return '***MASKED***';
  return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logger.log('🔍 [GET-TX-BY-TOKEN] Starting transaction fetch');

    // Use anon key for anonymous access via RLS policy
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      logger.error('❌ [GET-TX-BY-TOKEN] Missing env variables');
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
      // Log invalid format attempt using secure function
      try {
        await adminClient.rpc('log_transaction_access', {
          p_token: token,
          p_transaction_id: null,
          p_success: false,
          p_ip_address: ipAddress,
          p_user_agent: userAgent,
          p_error_reason: 'invalid_token_format'
        });
      } catch (logError) {
        logger.error('Failed to log invalid token attempt:', logError);
      }
      
      return new Response(
        JSON.stringify({ success: false, error: 'Format de token invalide', reason: 'invalid_token_format' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Check for abuse patterns (brute-force detection)
    // Now returns only a boolean, no sensitive data exposed
    const { data: isBlocked, error: abuseError } = await supabaseClient
      .rpc('check_token_abuse_secure', { 
        check_token: token, 
        check_ip: ipAddress 
      });

    if (abuseError) {
      logger.error('❌ [GET-TX-BY-TOKEN] Error checking abuse:', abuseError);
    }

    if (isBlocked) {
      logger.warn('⚠️ [GET-TX-BY-TOKEN] Suspicious activity detected', {
        token: maskToken(token), 
        ipAddress: maskToken(ipAddress)
      });
      
      // Log the blocked attempt using secure function
      try {
        await adminClient.rpc('log_transaction_access', {
          p_token: token,
          p_transaction_id: null,
          p_success: false,
          p_ip_address: ipAddress,
          p_user_agent: userAgent,
          p_error_reason: 'rate_limit_exceeded'
        });
      } catch (logError) {
        logger.error('Failed to log rate limit attempt:', logError);
      }

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Trop de tentatives. Veuillez réessayer plus tard.', 
          reason: 'rate_limit_exceeded' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
      );
    }

    logger.log('🔍 [GET-TX-BY-TOKEN] Fetching transaction with masked token:', maskToken(token));

    // Try by shared_link_token using the secure view (only exposes non-sensitive data)
    let transaction: any = null;
    let transactionId: string | null = null;

    // Try to find transaction by shared_link_token first
    const { data: txByToken, error: tokenError } = await adminClient
      .from('transactions')
      .select('id')
      .eq('shared_link_token', token)
      .eq('status', 'pending')
      .maybeSingle();

    if (txByToken) {
      transactionId = txByToken.id;
      logger.log('✅ [GET-TX-BY-TOKEN] Found by shared_link_token:', transactionId);
    } else {
      // Fallback: try direct ID lookup
      const { data: txById, error: idError } = await adminClient
        .from('transactions')
        .select('id')
        .eq('id', token)
        .maybeSingle();

      if (txById) {
        transactionId = txById.id;
        logger.log('✅ [GET-TX-BY-TOKEN] Found by direct ID:', transactionId);
      }
    }

    if (!transactionId) {
      logger.error('❌ [GET-TX-BY-TOKEN] Transaction not found');
      
      // Log failed access attempt using secure function
      try {
        await adminClient.rpc('log_transaction_access', {
          p_token: token,
          p_transaction_id: null,
          p_success: false,
          p_ip_address: ipAddress,
          p_user_agent: userAgent,
          p_error_reason: 'transaction_not_found'
        });
      } catch (logError) {
        logger.error('Failed to log access attempt:', logError);
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Transaction non trouvée, token invalide ou expiré', 
          reason: 'not_found' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Fetch full transaction data using admin client (with sensitive fields for internal use)
    const { data: fullTx, error: fullTxError } = await adminClient
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (fullTxError || !fullTx) {
      logger.error('❌ [GET-TX-BY-TOKEN] Failed to fetch full transaction:', fullTxError);
      return new Response(
        JSON.stringify({ success: false, error: 'Transaction data unavailable', reason: 'fetch_error' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    transaction = fullTx;


    logger.log('✅ [GET-TX-BY-TOKEN] Transaction found:', transaction.id);

    // Log successful access using secure function
    try {
      await adminClient.rpc('log_transaction_access', {
        p_token: token,
        p_transaction_id: transaction.id,
        p_success: true,
        p_ip_address: ipAddress,
        p_user_agent: userAgent,
        p_error_reason: null
      });
    } catch (logError) {
      logger.error('Failed to log successful access:', logError);
    }

    // Fetch minimal seller profile (no PII exposure via direct query)
    let sellerProfile = null;
    if (transaction.user_id) {
      const { data: profileData } = await adminClient
        .from('profiles')
        .select('first_name, last_name, user_type')
        .eq('user_id', transaction.user_id)
        .maybeSingle();
      
      if (profileData) {
        sellerProfile = profileData;
      }
    }

    // Fetch minimal buyer profile if buyer exists (no email exposure)
    let buyerProfile = null;
    if (transaction.buyer_id) {
      const { data: profileData } = await adminClient
        .from('profiles')
        .select('first_name, last_name, user_type')
        .eq('user_id', transaction.buyer_id)
        .maybeSingle();
        
      if (profileData) {
        buyerProfile = profileData;
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
    logger.error('❌ [GET-TX-BY-TOKEN] Error:', error);
    
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