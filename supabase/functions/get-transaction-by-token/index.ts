import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { logger } from "../_shared/logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Security: Mask sensitive tokens in logs
function maskToken(token: string): string {
  if (!token || token.length < 12) return '***MASKED***';
  return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
}

// Normalize tokens copied from various apps (removes zero-width chars, BOM, trims, decodes URI)
function sanitizeToken(input: string): string {
  if (!input) return '';
  let t = input;
  try {
    // decode percent-encoded values if any
    t = decodeURIComponent(t);
  } catch (_) {
    // ignore decoding errors, keep original
  }
  // remove zero-width and BOM characters, then trim spaces
  t = t.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  return t;
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

    // Support both GET (query param) and POST (JSON body)
    let token: string | null = null;
    const url = new URL(req.url);
    token = url.searchParams.get('token');

    if (!token && req.method === 'POST') {
      try {
        const body = await req.json();
        token = body?.token ?? null;
      } catch (_) {
        // ignore JSON parse errors
      }
    }

    // Sanitize token before any processing (handles copy/paste artifacts)
    token = sanitizeToken(token || '');
    
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token manquant', reason: 'missing_token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Token parsing: support combined format "<txId>-<linkToken>" and single tokens
    const uuidPart = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
    const combinedRe = new RegExp(`^(${uuidPart})-(${uuidPart})$`, 'i');
    const uuidRegex = new RegExp(`^${uuidPart}$`, 'i');

    let parsedTransactionId: string | null = null;
    let parsedLinkToken: string | null = null;

    const combinedMatch = token.match(combinedRe);
    if (combinedMatch) {
      parsedTransactionId = combinedMatch[1];
      parsedLinkToken = combinedMatch[2];
      logger.log('🔎 [GET-TX-BY-TOKEN] Detected combined token format');
    } else if (uuidRegex.test(token)) {
      // Could be either the transaction id or a UUID-based link token
      parsedLinkToken = token;
    } else {
      // Non-UUID token (secure random) — treat as link token
      parsedLinkToken = token;
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

    let transaction: any = null;
    let transactionId: string | null = null;

    // PRIORITY 1: Try exact match on shared_link_token (handles "uuid-uuid" format)
    const { data: txByExactToken } = await adminClient
      .from('transactions')
      .select('id')
      .eq('shared_link_token', token)
      .maybeSingle();

    if (txByExactToken) {
      transactionId = txByExactToken.id;
      logger.log('✅ [GET-TX-BY-TOKEN] Found by exact shared_link_token:', transactionId);
    } else {
      // PRIORITY 2: Parse and try combined format fallbacks
      // Combined format: strict match on id + token
      if (parsedTransactionId && parsedLinkToken) {
        const { data: byBoth } = await adminClient
          .from('transactions')
          .select('id')
          .eq('id', parsedTransactionId)
          .eq('shared_link_token', parsedLinkToken)
          .maybeSingle();

        if (byBoth) {
          transactionId = byBoth.id;
          logger.log('✅ [GET-TX-BY-TOKEN] Found by id+token:', transactionId);
        } else {
          // Try reversed order (parts might be swapped)
          const { data: byBothReversed } = await adminClient
            .from('transactions')
            .select('id')
            .eq('id', parsedLinkToken)
            .eq('shared_link_token', parsedTransactionId)
            .maybeSingle();

          if (byBothReversed) {
            transactionId = byBothReversed.id;
            logger.log('✅ [GET-TX-BY-TOKEN] Found by reversed id+token:', transactionId);
          }
        }
      }

      // Fallback: try by shared_link_token with parsed token only
      if (!transactionId && parsedLinkToken && parsedLinkToken !== token) {
        const { data: txByToken } = await adminClient
          .from('transactions')
          .select('id')
          .eq('shared_link_token', parsedLinkToken)
          .maybeSingle();

        if (txByToken) {
          transactionId = txByToken.id;
          logger.log('✅ [GET-TX-BY-TOKEN] Found by parsed shared_link_token:', transactionId);
        }
      }

      // Fallback: try by id only
      if (!transactionId && parsedTransactionId) {
        const { data: txById } = await adminClient
          .from('transactions')
          .select('id')
          .eq('id', parsedTransactionId)
          .maybeSingle();

        if (txById) {
          transactionId = txById.id;
          logger.log('✅ [GET-TX-BY-TOKEN] Found by direct ID:', transactionId);
        }
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

    // Whitelist-only response (no sensitive fields)
    const safeTransaction = {
      id: transaction.id,
      title: transaction.title,
      description: transaction.description,
      price: transaction.price,
      currency: transaction.currency,
      seller_display_name: transaction.seller_display_name,
      service_date: transaction.service_date,
      payment_deadline: transaction.payment_deadline,
      status: transaction.status,
    };

    return new Response(
      JSON.stringify({ 
        success: true,
        transaction: safeTransaction,
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