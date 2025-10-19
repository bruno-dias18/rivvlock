import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { 
  compose, 
  withCors, 
  successResponse,
  errorResponse,
  Handler 
} from "../_shared/middleware.ts";
import { createServiceClient } from "../_shared/supabase-utils.ts";
import { logger } from "../_shared/logger.ts";

// Security: Mask sensitive tokens in logs
function maskToken(token: string): string {
  if (!token || token.length < 12) return '***MASKED***';
  return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
}

// Normalize tokens copied from various apps
function sanitizeToken(input: string): string {
  if (!input) return '';
  let t = input;
  try {
    t = decodeURIComponent(t);
  } catch (_) {
    // ignore decoding errors
  }
  t = t.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  return t;
}

const handler: Handler = async (req) => {
  logger.log('🔍 [GET-TX-BY-TOKEN] Starting transaction fetch');

  const supabaseClient = createServiceClient();
  const adminClient = createServiceClient();

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

  // Sanitize token
  token = sanitizeToken(token || '');
  
  if (!token) {
    return errorResponse('Token manquant', 400, { reason: 'missing_token' });
  }

  // Token parsing: support combined format "<txId>-<linkToken>"
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
    parsedLinkToken = token;
  } else {
    parsedLinkToken = token;
  }

  // Note: We intentionally defer abuse checks until after we know whether the token
  // matches a real transaction to avoid false positives for legitimate users.
  // This prevents blocking valid tokens when users retry multiple times.


  logger.log('🔍 [GET-TX-BY-TOKEN] Fetching transaction with masked token:', maskToken(token));

  let transactionId: string | null = null;
  let rpcFallbackUsed = false;

  // PRIORITY 1: Try exact match on shared_link_token
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

    // RPC Fallback: use secure function to bypass RLS
    if (!transactionId) {
      logger.log('🔄 [GET-TX-BY-TOKEN] Using RPC fallback: get_transaction_by_token_safe');
      const { data: rpcData, error: rpcError } = await supabaseClient
        .rpc('get_transaction_by_token_safe', { p_token: token });

      if (rpcError) {
        logger.error('❌ [GET-TX-BY-TOKEN] RPC fallback error:', rpcError);
      } else if (rpcData && rpcData.length > 0) {
        const rpcTx = rpcData[0];
        logger.log('✅ [GET-TX-BY-TOKEN] Transaction found via RPC:', rpcTx.id);
        
        if (rpcTx.is_expired) {
          logger.warn('⚠️ [GET-TX-BY-TOKEN] Transaction expired via RPC');
          try {
            await adminClient.rpc('log_transaction_access', {
              p_token: token,
              p_transaction_id: rpcTx.id,
              p_success: false,
              p_ip_address: ipAddress,
              p_user_agent: userAgent,
              p_error_reason: 'expired'
            });
          } catch (logError) {
            logger.error('Failed to log expired access:', logError);
          }
          return errorResponse('Lien expiré', 410, { reason: 'expired' });
        }
        
        transactionId = rpcTx.id;
        rpcFallbackUsed = true;
      } else {
        logger.log('ℹ️ [GET-TX-BY-TOKEN] RPC returned no data, token not found');
      }
    }
  }

  if (!transactionId) {
    logger.error('❌ [GET-TX-BY-TOKEN] Transaction not found');

    // Now check for abuse only when token didn't match any transaction
    let isBlocked: boolean | null = null;
    try {
      const { data, error: abuseError } = await supabaseClient
        .rpc('check_token_abuse_secure', { 
          check_token: token, 
          check_ip: ipAddress 
        });
      if (abuseError) {
        logger.error('❌ [GET-TX-BY-TOKEN] Error checking abuse:', abuseError);
      } else {
        isBlocked = data as unknown as boolean;
      }
    } catch (err) {
      logger.error('❌ [GET-TX-BY-TOKEN] Abuse check failed:', err);
    }

    if (isBlocked) {
      logger.warn('⚠️ [GET-TX-BY-TOKEN] Suspicious activity detected', {
        token: maskToken(token), 
        ipAddress: maskToken(ipAddress)
      });
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

      return errorResponse(
        'Trop de tentatives. Veuillez réessayer plus tard.',
        429,
        { reason: 'rate_limit_exceeded' }
      );
    }

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

    return errorResponse(
      'Transaction non trouvée, token invalide ou expiré',
      404,
      { reason: 'not_found' }
    );
  }

  // Fetch full transaction data
  const { data: fullTx, error: fullTxError } = await adminClient
    .from('transactions')
    .select('*')
    .eq('id', transactionId)
    .single();

  if (fullTxError || !fullTx) {
    logger.error('❌ [GET-TX-BY-TOKEN] Failed to fetch full transaction:', fullTxError);
    return errorResponse('Transaction data unavailable', 500, { reason: 'fetch_error' });
  }

  const transaction = fullTx;

  // Server-side expiration check (unless RPC already handled it)
  if (!rpcFallbackUsed && transaction.shared_link_expires_at && new Date(transaction.shared_link_expires_at) < new Date()) {
    try {
      await adminClient.rpc('log_transaction_access', {
        p_token: token,
        p_transaction_id: transaction.id,
        p_success: false,
        p_ip_address: ipAddress,
        p_user_agent: userAgent,
        p_error_reason: 'expired'
      });
    } catch (logError) {
      logger.error('Failed to log expired access:', logError);
    }
    return errorResponse('Lien expiré', 410, { reason: 'expired' });
  }

  logger.log('✅ [GET-TX-BY-TOKEN] Transaction found:', transaction.id);

  // Log successful access
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

  // Fetch minimal seller profile
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

  // Fetch minimal buyer profile
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

  // Whitelist-only response
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

  return successResponse({ 
    transaction: safeTransaction,
    seller_profile: sellerProfile,
    buyer_profile: buyerProfile
  });
};

const composedHandler = compose(withCors)(handler);

serve(composedHandler);
