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
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { token } = await req.json();
    
    if (!token) {
      throw new Error('Token manquant');
    }

    // Validate token format (basic UUID check)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token)) {
      throw new Error('Format de token invalide');
    }

    console.log('🔍 [GET-TX-BY-TOKEN] Fetching transaction with token:', token);

    // Fetch transaction by shared_link_token
    const { data: transaction, error: fetchError } = await adminClient
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
      .single();

    if (fetchError || !transaction) {
      console.error('❌ [GET-TX-BY-TOKEN] Transaction not found:', fetchError);
      throw new Error('Transaction non trouvée ou token invalide');
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
      throw new Error('Le lien d\'invitation a expiré');
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
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});