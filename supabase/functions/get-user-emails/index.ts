import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { sellerUserId, buyerUserId } = await req.json()

    // Get seller email
    let sellerEmail = null;
    if (sellerUserId) {
      const { data: sellerData } = await supabaseClient.auth.admin.getUserById(sellerUserId);
      sellerEmail = sellerData.user?.email;
    }

    // Get buyer email  
    let buyerEmail = null;
    if (buyerUserId) {
      const { data: buyerData } = await supabaseClient.auth.admin.getUserById(buyerUserId);
      buyerEmail = buyerData.user?.email;
    }

    return new Response(
      JSON.stringify({ 
        sellerEmail,
        buyerEmail 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})