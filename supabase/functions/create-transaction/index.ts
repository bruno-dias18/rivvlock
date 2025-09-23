import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper logging function
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-TRANSACTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Function started');

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

    // Parse request body
    const { title, description, price, currency, serviceDate } = await req.json();
    
    if (!title || !description || !price || !currency || !serviceDate) {
      throw new Error('Missing required fields');
    }

    logStep('Request data received', { title, price, currency });

    // Generate unique token for shared link
    const sharedLinkToken = crypto.randomUUID();
    
    // Set expiration date (7 days from now)
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 7);

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
    const { data: transaction, error: transactionError } = await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: user.id,
        title,
        description,
        price,
        currency,
        service_date: serviceDate,
        shared_link_token: sharedLinkToken,
        seller_display_name: sellerDisplayName,
        status: 'pending'
      })
      .select()
      .single();

    if (transactionError) {
      logStep('Transaction creation failed', transactionError);
      throw new Error(`Failed to create transaction: ${transactionError.message}`);
    }

    logStep('Transaction created successfully', { transactionId: transaction.id, token: sharedLinkToken });

    // Return transaction data with share link - always use the rivvlock domain
    const baseUrl = 'https://rivvlock.lovable.app';
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