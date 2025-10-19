import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { logger } from "../_shared/logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Fetch user's transactions
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .or(`user_id.eq.${user.id},buyer_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(200);

    if (txError) {
      logger.error('Error fetching transactions:', txError);
      throw txError;
    }

    if (!transactions || transactions.length === 0) {
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const transactionIds = transactions.map(t => t.id);

    // Fetch disputes with accepted proposals for these transactions
    const { data: disputesData, error: disputesError } = await supabase
      .from('disputes')
      .select('transaction_id, dispute_proposals!inner(refund_percentage, proposal_type, status, updated_at)')
      .in('transaction_id', transactionIds)
      .eq('dispute_proposals.status', 'accepted');

    if (disputesError) {
      logger.error('Error fetching disputes:', disputesError);
      // Continue without refund data rather than failing
    }

    // Create refund map
    const refundMap = new Map<string, number>();
    
    if (disputesData && disputesData.length > 0) {
      disputesData.forEach((dispute: any) => {
        const proposals = (dispute.dispute_proposals || []) as any[];
        if (!proposals.length) return;

        // Sort by updated_at desc to get the most recent accepted proposal
        proposals.sort((a, b) => 
          new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
        );

        // Priority 1: full_refund
        const full = proposals.find(p => p.proposal_type === 'full_refund');
        if (full) {
          refundMap.set(dispute.transaction_id, 100);
          return;
        }

        // Priority 2: partial_refund with percentage
        const partial = proposals.find(
          p => p.proposal_type === 'partial_refund' && p.refund_percentage != null
        );
        if (partial) {
          refundMap.set(dispute.transaction_id, Number(partial.refund_percentage));
          return;
        }
      });
    }

    // Enrich transactions with refund_percentage
    const enrichedTransactions = transactions.map(transaction => ({
      ...transaction,
      refund_percentage: refundMap.get(transaction.id) || null,
    }));

    return new Response(JSON.stringify(enrichedTransactions), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    logger.error('Error in get-transactions-enriched:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: error.message === 'Unauthorized' ? 401 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
