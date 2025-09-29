import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FixRequestBody {
  transactionId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: req.headers.get('Authorization') ?? '',
          },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[FIX-REACTIVATED] Authentication error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const body = (await req.json().catch(() => ({}))) as FixRequestBody;
    const nowIso = new Date().toISOString();

    // Build base query with RLS: only the caller's accessible transactions
    let query = supabase
      .from('transactions')
      .select('id, status, date_change_status, payment_deadline')
      .eq('date_change_status', 'approved')
      .lt('payment_deadline', nowIso);

    // Include both pending and expired just in case
    query = query.in('status', ['pending', 'expired']);

    if (body.transactionId) {
      query = query.eq('id', body.transactionId);
    }

    const { data: affected, error: fetchError } = await query;

    if (fetchError) {
      console.error('[FIX-REACTIVATED] Fetch error:', fetchError);
      return new Response(JSON.stringify({ error: 'Failed to fetch transactions' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (!affected || affected.length === 0) {
      console.log('[FIX-REACTIVATED] No transactions to fix');
      return new Response(JSON.stringify({ fixedCount: 0, updatedIds: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Compute a new deadline: 22:00 tomorrow
    const newDeadline = new Date();
    newDeadline.setDate(newDeadline.getDate() + 1);
    newDeadline.setHours(22, 0, 0, 0);
    const newDeadlineIso = newDeadline.toISOString();

    const ids = affected.map(a => a.id);

    const { error: updateError } = await supabase
      .from('transactions')
      .update({ payment_deadline: newDeadlineIso, status: 'pending' })
      .in('id', ids);

    if (updateError) {
      console.error('[FIX-REACTIVATED] Update error:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update transactions' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Log activities for the user for traceability (best-effort)
    const logs = ids.map((id, idx) => ({
      user_id: user.id,
      activity_type: 'system_fix',
      title: 'Délai de paiement corrigé',
      description: 'Le délai de paiement a été réinitialisé à 22:00 demain pour une transaction réactivée.',
      metadata: {
        transaction_id: id,
        old_payment_deadline: affected[idx]?.payment_deadline ?? null,
        new_payment_deadline: newDeadlineIso,
      }
    }));

    const { error: logError } = await supabase
      .from('activity_logs')
      .insert(logs);

    if (logError) {
      console.warn('[FIX-REACTIVATED] Activity log insert warning:', logError);
    }

    console.log(`[FIX-REACTIVATED] Fixed ${ids.length} transaction(s)`);

    return new Response(JSON.stringify({ fixedCount: ids.length, updatedIds: ids }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error: any) {
    console.error('[FIX-REACTIVATED] Unexpected error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

serve(handler);
