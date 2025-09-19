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
    console.log('Join Transaction Function: Starting request processing');

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Aucun token d\'authentification fourni');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      throw new Error('Utilisateur non authentifié');
    }

    console.log('Join Transaction Function: User authenticated:', userData.user.id);

    // Parse request body
    const { transaction_id, token: linkToken } = await req.json();
    
    if (!transaction_id || !linkToken) {
      throw new Error('ID de transaction ou token manquant');
    }

    console.log('Join Transaction Function: Processing transaction:', transaction_id);

    // Verify transaction exists and token is valid
    const { data: transaction, error: fetchError } = await supabaseClient
      .from('transactions')
      .select('*')
      .eq('id', transaction_id)
      .eq('shared_link_token', linkToken)
      .single();

    if (fetchError || !transaction) {
      throw new Error('Transaction non trouvée ou token invalide');
    }

    console.log('Join Transaction Function: Transaction found:', transaction.id);

    // Check if link is expired
    if (transaction.link_expires_at && new Date(transaction.link_expires_at) < new Date()) {
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
      console.log('Join Transaction Function: User already assigned as buyer');
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

    // Assign user as buyer
    const { error: updateError } = await supabaseClient
      .from('transactions')
      .update({ 
        buyer_id: userData.user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', transaction_id);

    if (updateError) {
      throw new Error('Erreur lors de l\'assignation à la transaction');
    }

    console.log('Join Transaction Function: Successfully assigned buyer:', userData.user.id);

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