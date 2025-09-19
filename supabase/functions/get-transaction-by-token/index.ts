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
    console.log('🔍 [GET-TRANSACTION] Starting public transaction fetch');

    // Use service role key for admin access to read transaction data
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { token } = await req.json();
    
    if (!token) {
      throw new Error('Token manquant');
    }

    console.log('🔍 [GET-TRANSACTION] Fetching transaction with token');

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
        profiles:user_id(first_name, last_name, company_name)
      `)
      .eq('shared_link_token', token)
      .single();

    if (fetchError || !transaction) {
      console.error('❌ [GET-TRANSACTION] Transaction not found:', fetchError);
      throw new Error('Transaction non trouvée ou token invalide');
    }

    // Check if link is expired
    const expiresAt = transaction.shared_link_expires_at || transaction.link_expires_at;
    if (expiresAt && new Date(expiresAt) < new Date()) {
      console.error('❌ [GET-TRANSACTION] Link expired');
      throw new Error('Le lien d\'invitation a expiré');
    }

    console.log('✅ [GET-TRANSACTION] Transaction found:', transaction.id);

    return new Response(
      JSON.stringify({ 
        success: true,
        transaction: transaction
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ [GET-TRANSACTION] Error:', error);
    
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