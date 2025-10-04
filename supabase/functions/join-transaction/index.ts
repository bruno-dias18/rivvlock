import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logger } from "../_shared/logger.ts";
import { checkRateLimit, getClientIp } from "../_shared/rate-limiter.ts";
import { validate, joinTransactionSchema } from "../_shared/validation.ts";

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
    logger.log('🔍 [JOIN-TRANSACTION] Starting request processing');

    // Rate limiting - protection contre les abus
    const clientIp = getClientIp(req);
    await checkRateLimit(clientIp);

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

    logger.log('✅ [JOIN-TRANSACTION] User authenticated:', userData.user.id);

    // Rate limiting par utilisateur
    await checkRateLimit(clientIp, userData.user.id);

    // Parse request body (support both `token` and `linkToken`)
    const body = await req.json();
    
    // Validation des données d'entrée
    const validatedData = validate(joinTransactionSchema, body);
    const transaction_id = validatedData.transaction_id;
    const linkToken = validatedData.linkToken || validatedData.token;

    logger.log('🔍 [JOIN-TRANSACTION] Processing transaction:', transaction_id);

    // Verify transaction exists and token is valid (using admin client)
    const { data: transaction, error: fetchError } = await adminClient
      .from('transactions')
      .select('*')
      .eq('id', transaction_id)
      .eq('shared_link_token', linkToken)
      .single();

    if (fetchError || !transaction) {
      logger.error('❌ [JOIN-TRANSACTION] Transaction fetch error:', fetchError);
      throw new Error('Transaction non trouvée ou token invalide');
    }

    logger.log('✅ [JOIN-TRANSACTION] Transaction found:', transaction.id);

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
      logger.log('✅ [JOIN-TRANSACTION] User already assigned as buyer');
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

    // Calculate payment deadline (24h before service date and time)
    const serviceDate = new Date(transaction.service_date);
    const paymentDeadline = new Date(serviceDate.getTime() - 24 * 60 * 60 * 1000);
    
    logger.log('🕒 [JOIN-TRANSACTION] Payment deadline calculation:', {
      serviceDate: serviceDate.toISOString(),
      paymentDeadline: paymentDeadline.toISOString(),
      timeDiff: (serviceDate.getTime() - paymentDeadline.getTime()) / (1000 * 60 * 60)
    });
    
    // Validate that payment deadline is in the future
    const now = new Date();
    if (paymentDeadline <= now) {
      return new Response(
        JSON.stringify({ 
          error: 'Service trop proche : le paiement doit être possible au moins 24h avant le service.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Assign user as buyer (using admin client to bypass RLS)
    const { error: updateError } = await adminClient
      .from('transactions')
      .update({ 
        buyer_id: userData.user.id,
        buyer_display_name: buyerDisplayName,
        payment_deadline: paymentDeadline.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', transaction_id);

    if (updateError) {
      logger.error('❌ [JOIN-TRANSACTION] Update error:', updateError);
      throw new Error('Erreur lors de l\'assignation à la transaction');
    }

    logger.log('✅ [JOIN-TRANSACTION] Successfully assigned buyer:', userData.user.id);

    // Log activity for both buyer and seller
    try {
      // Log for the buyer
      await adminClient
        .from('activity_logs')
        .insert({
          user_id: userData.user.id,
          activity_type: 'transaction_joined',
          title: 'Transaction rejointe',
          description: `Vous avez rejoint la transaction "${transaction.title}"`
        });

      // Log for the seller
      await adminClient
        .from('activity_logs')
        .insert({
          user_id: transaction.user_id,
          activity_type: 'buyer_joined_transaction',
          title: `${buyerDisplayName} a rejoint votre transaction`,
          description: `Un client a rejoint votre transaction "${transaction.title}"`,
          metadata: {
            transaction_id: transaction.id,
            buyer_id: userData.user.id,
            buyer_name: buyerDisplayName
          }
        });
    } catch (logError) {
      logger.error('❌ [JOIN-TRANSACTION] Error logging activity:', logError);
    }

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
    logger.error('Join Transaction Function Error:', error);
    
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