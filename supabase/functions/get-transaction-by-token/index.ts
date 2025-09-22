import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 [GET-TX-BY-TOKEN] Starting transaction fetch');

    // Use service role key for admin access to read transaction data
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('❌ [GET-TX-BY-TOKEN] Missing env variables', {
        hasUrl: !!supabaseUrl,
        hasServiceRole: !!serviceRoleKey
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Configuration serveur incomplète',
          reason: 'env_missing'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { token } = await req.json();
    
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token manquant', reason: 'missing_token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate token format (basic UUID check)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Format de token invalide', reason: 'invalid_token_format' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('🔍 [GET-TX-BY-TOKEN] Fetching transaction with token:', token);

// Try by shared_link_token first, then fallback to id (backward compatibility)
let transaction: any = null;
let lookupMethod: 'shared_link_token' | 'id' | 'none' = 'none';

const { data: txByToken, error: errByToken } = await adminClient
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
    shared_link_expires_at,
    link_expires_at,
    payment_deadline,
    created_at,
    payment_method,
    payment_blocked_at,
    stripe_payment_intent_id,
    seller_validated,
    buyer_validated,
    validation_deadline,
    funds_released,
    dispute_id
  `)
  .eq('shared_link_token', token)
  .maybeSingle();

if (txByToken) {
  transaction = txByToken;
  lookupMethod = 'shared_link_token';
  console.log('✅ [GET-TX-BY-TOKEN] Found by shared_link_token:', transaction.id);
} else {
  console.warn('⚠️ [GET-TX-BY-TOKEN] Not found by shared_link_token, trying by id. Error:', errByToken);
  const { data: txById, error: errById } = await adminClient
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
      shared_link_expires_at,
      link_expires_at,
      payment_deadline,
      created_at,
      payment_method,
      payment_blocked_at,
      stripe_payment_intent_id,
      seller_validated,
      buyer_validated,
      validation_deadline,
      funds_released,
      dispute_id
    `)
    .eq('id', token)
    .maybeSingle();
  if (txById) {
    transaction = txById;
    lookupMethod = 'id';
    console.log('✅ [GET-TX-BY-TOKEN] Found by id (backward compat):', transaction.id);
  } else {
    console.error('❌ [GET-TX-BY-TOKEN] Transaction not found by token nor id', { errByToken, errById });
    return new Response(
      JSON.stringify({ success: false, error: 'Transaction non trouvée ou token invalide', reason: 'not_found' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
    );
  }
}


    // Check if link is expired
    const expiresAt = transaction.shared_link_expires_at || transaction.link_expires_at;
    const now = new Date();
    const expirationDate = expiresAt ? new Date(expiresAt) : null;
    
    console.log('🕒 [GET-TX-BY-TOKEN] Expiration check:', {
      expiresAt,
      now: now.toISOString(),
      expirationDate: expirationDate?.toISOString(),
      isExpired: expirationDate ? expirationDate < now : false
    });
    
    if (expirationDate && expirationDate < now) {
      console.error('❌ [GET-TX-BY-TOKEN] Link expired:', {
        expirationDate: expirationDate.toISOString(),
        currentTime: now.toISOString()
      });
      return new Response(
        JSON.stringify({ success: false, error: 'Le lien d\'invitation a expiré', reason: 'link_expired' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 410 }
      );
    }

    console.log('✅ [GET-TX-BY-TOKEN] Transaction found:', transaction.id);

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