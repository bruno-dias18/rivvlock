import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { logger } from "../_shared/logger.ts";
import { checkRateLimit, getClientIp } from "../_shared/rate-limiter.ts";
import { validate, createTransactionSchema } from "../_shared/validation.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper logging function
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  logger.log(`[CREATE-TRANSACTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Function started');

    // Rate limiting - protection contre les abus
    const clientIp = getClientIp(req);
    await checkRateLimit(clientIp);

    // Initialize Supabase clients
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header provided');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user) throw new Error('User not authenticated');
    
    logStep('User authenticated', { userId: user.id, email: user.email });

    // Rate limiting par utilisateur
    await checkRateLimit(clientIp, user.id);

    // Parse request body
    const requestBody = await req.json();
    
    // Validation des données d'entrée
    const validatedData = validate(createTransactionSchema, requestBody);
    const { title, description, price, currency, serviceDate, serviceEndDate, paymentDeadlineHours, clientEmail, fee_ratio_client } = validatedData;

    // Validation supplémentaire des montants (sécurité)
    if (price < 1 || price > 1000000) {
      throw new Error('Le montant doit être entre 1 et 1 000 000');
    }

    logStep('Request data validated', { title, price, currency, serviceEndDate, paymentDeadlineHours });

    // Generate secure 256-bit token for shared link
    const sharedLinkToken = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
    
    // Calculate payment deadline using custom hours (default 24h)
    const deadlineHours = paymentDeadlineHours || 24;
    const serviceDateObj = new Date(serviceDate);
    const paymentDeadline = new Date(serviceDateObj.getTime() - (deadlineHours * 60 * 60 * 1000));
    
    // Set shared link expiration to payment deadline
    const sharedLinkExpiresAt = paymentDeadline;
    
    logStep('Payment deadline calculated', { deadlineHours, paymentDeadline: paymentDeadline.toISOString() });

    // Get seller's display name from profiles
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('first_name, last_name, company_name, user_type')
      .eq('user_id', user.id)
      .single();

    let sellerDisplayName = user.email || 'Vendeur';
    if (profileData) {
      if (profileData.user_type === 'company' && profileData.company_name) {
        sellerDisplayName = profileData.company_name;
      } else if (profileData.first_name && profileData.last_name) {
        sellerDisplayName = `${profileData.first_name} ${profileData.last_name}`;
      } else if (profileData.first_name) {
        sellerDisplayName = profileData.first_name;
      }
    }

    logStep('Seller display name determined', { sellerDisplayName });

    // Create transaction
    const transactionData: any = {
      user_id: user.id,
      title,
      description,
      price,
      currency,
      service_date: serviceDate,
      shared_link_token: sharedLinkToken,
      shared_link_expires_at: sharedLinkExpiresAt.toISOString(),
      payment_deadline: paymentDeadline.toISOString(),
      seller_display_name: sellerDisplayName,
      status: 'pending',
      client_email: clientEmail || null,
      fee_ratio_client: fee_ratio_client || 0
    };

    // Add service_end_date if provided
    if (serviceEndDate) {
      transactionData.service_end_date = serviceEndDate;
    }

    const { data: transaction, error: transactionError } = await supabaseAdmin
      .from('transactions')
      .insert(transactionData)
      .select()
      .single();

    if (transactionError) {
      logStep('Transaction creation failed', transactionError);
      throw new Error(`Failed to create transaction: ${transactionError.message}`);
    }

    logStep('Transaction created successfully', { transactionId: transaction.id, token: sharedLinkToken });

    // Send email if clientEmail provided
    if (clientEmail) {
      try {
        logStep('Sending transaction creation email', { to: clientEmail });
        
        const emailResult = await supabaseAdmin.functions.invoke('send-email', {
          body: {
            type: 'transaction_created',
            to: clientEmail,
            data: {
              sellerName: sellerDisplayName,
              transactionTitle: transaction.title,
              amount: transaction.price,
              currency: transaction.currency,
              serviceDate: new Date(serviceDate).toLocaleString('fr-FR', {
                dateStyle: 'long',
                timeStyle: 'short'
              }),
              paymentDeadline: paymentDeadline.toLocaleString('fr-FR', {
                dateStyle: 'long',
                timeStyle: 'short'
              }),
              shareLink: `https://app.rivvlock.com/join/${sharedLinkToken}`
            }
          }
        });
        
        if (emailResult.error) {
          logStep('Email sending failed (non-blocking)', emailResult.error);
        } else {
          logStep('Email sent successfully', { to: clientEmail });
        }
      } catch (emailError) {
        logStep('Email error (non-blocking)', emailError);
      }
    }

    // Log activity for transaction creation
    try {
      await supabaseAdmin
        .from('activity_logs')
        .insert({
          user_id: user.id,
          activity_type: 'transaction_created',
          title: 'Transaction créée',
          description: `Nouvelle transaction "${transaction.title}" créée pour ${transaction.price} ${transaction.currency}`,
          metadata: {
            transaction_id: transaction.id,
            price: transaction.price,
            currency: transaction.currency,
            service_date: serviceDate
          }
        });
    } catch (logError) {
      logger.error('❌ [CREATE-TRANSACTION] Error logging activity:', logError);
    }

    // Return transaction data with share link - always use the public domain
    const baseUrl = 'https://app.rivvlock.com';
    const shareLink = `${baseUrl}/join/${sharedLinkToken}`;

    return new Response(JSON.stringify({
      success: true,
      transaction: {
        id: transaction.id,
        title: transaction.title,
        shareLink,
        token: sharedLinkToken
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep('ERROR in create-transaction', { message: errorMessage });
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      success: false 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});