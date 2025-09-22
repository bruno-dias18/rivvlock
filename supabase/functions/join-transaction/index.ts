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
    console.log('🔍 [JOIN-TRANSACTION] Starting request processing');

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
      throw new Error('Aucun token d\'authentification fourni');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      throw new Error('Utilisateur non authentifié');
    }

    console.log('✅ [JOIN-TRANSACTION] User authenticated:', userData.user.id);

    // Parse request body (support both `token` and `linkToken`)
    const body = await req.json();
    const transaction_id = body.transaction_id;
    const linkToken = body.linkToken || body.token;

    if (!transaction_id || !linkToken) {
      throw new Error('ID de transaction ou token manquant');
    }

    console.log('🔍 [JOIN-TRANSACTION] Processing transaction:', transaction_id);

    // Verify transaction exists and token is valid (using admin client)
    const { data: transaction, error: fetchError } = await adminClient
      .from('transactions')
      .select('*')
      .eq('id', transaction_id)
      .eq('shared_link_token', linkToken)
      .single();

    if (fetchError || !transaction) {
      console.error('❌ [JOIN-TRANSACTION] Transaction fetch error:', fetchError);
      throw new Error('Transaction non trouvée ou token invalide');
    }

    console.log('✅ [JOIN-TRANSACTION] Transaction found:', transaction.id);

    // Check if link is expired
    const expiresAt = transaction.shared_link_expires_at || transaction.link_expires_at;
    if (expiresAt && new Date(expiresAt) < new Date()) {
      throw new Error('Le lien d\'invitation a expiré');
    }

    // Check if user is not the seller
    if (transaction.user_id === userData.user.id) {
      throw new Error('Vous ne pouvez pas rejoindre votre propre transaction');
    }

    // Check if transaction already has a buyer
    if (transaction.buyer_id && transaction.buyer_id !== userData.user.id) {
      throw new Error('Cette transaction a déjà un acheteur assigné');
    }

    // If user is already the buyer, return success
    if (transaction.buyer_id === userData.user.id) {
      console.log('✅ [JOIN-TRANSACTION] User already assigned as buyer');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Utilisateur déjà assigné à cette transaction' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Get buyer profile for display name
    const { data: buyerProfile } = await adminClient
      .from('profiles')
      .select('company_name, first_name, last_name')
      .eq('user_id', userData.user.id)
      .single();

    const buyerDisplayName = buyerProfile?.company_name || 
      `${buyerProfile?.first_name || ''} ${buyerProfile?.last_name || ''}`.trim() || 
      'Acheteur';

    // Assign user as buyer (using admin client to bypass RLS)
    const { error: updateError } = await adminClient
      .from('transactions')
      .update({ 
        buyer_id: userData.user.id,
        buyer_display_name: buyerDisplayName,
        payment_deadline: new Date(Date.now() + (transaction.payment_window_hours || 168) * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', transaction_id);

    if (updateError) {
      console.error('❌ [JOIN-TRANSACTION] Update error:', updateError);
      throw new Error('Erreur lors de l\'assignation à la transaction');
    }

    console.log('✅ [JOIN-TRANSACTION] Successfully assigned buyer:', userData.user.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Transaction rejointe avec succès',
        transaction_id: transaction_id,
        buyer_id: userData.user.id
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Join Transaction Function Error:', error);
    
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