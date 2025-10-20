import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fix the specific transaction
    const { data: proposals, error: propError } = await supabaseAdmin
      .from('dispute_proposals')
      .select('dispute_id, refund_percentage')
      .eq('status', 'accepted');

    if (propError) throw propError;

    let fixed = 0;
    for (const proposal of proposals || []) {
      const { data: dispute } = await supabaseAdmin
        .from('disputes')
        .select('transaction_id')
        .eq('id', proposal.dispute_id)
        .single();

      if (dispute) {
        const { error: updateError } = await supabaseAdmin
          .from('transactions')
          .update({ 
            refund_percentage: proposal.refund_percentage,
            updated_at: new Date().toISOString()
          })
          .eq('id', dispute.transaction_id)
          .eq('refund_status', 'partial')
          .is('refund_percentage', null);

        if (!updateError) fixed++;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        fixed,
        message: `Fixed ${fixed} transactions` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});