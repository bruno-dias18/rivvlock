import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function logStep(step: string, data?: any) {
  console.log(`[ADMIN-DISPUTE-ACTIONS] ${step}`, data ? JSON.stringify(data) : '');
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Function started');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get the authorization header
    const authorization = req.headers.get('Authorization');
    if (!authorization) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the user is authenticated and get user info
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authorization.replace('Bearer ', '')
    );

    if (userError || !user) {
      logStep('Authentication failed', { error: userError });
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logStep('User authenticated', { userId: user.id });

    // Check if user is admin
    const { data: adminCheck, error: adminError } = await supabase
      .rpc('is_admin', { check_user_id: user.id });

    if (adminError || !adminCheck) {
      logStep('Admin check failed', { error: adminError, isAdmin: adminCheck });
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logStep('Admin privileges confirmed');

    const { action, disputeId, message, notes, recipientId } = await req.json();
    logStep('Request parsed', { action, disputeId });

    if (!action || !disputeId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get dispute details
    const { data: dispute, error: disputeError } = await supabase
      .from('disputes')
      .select(`
        *,
        transactions (*)
      `)
      .eq('id', disputeId)
      .single();

    if (disputeError || !dispute) {
      logStep('Dispute not found', { error: disputeError });
      return new Response(
        JSON.stringify({ error: 'Dispute not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logStep('Dispute retrieved', { disputeId, status: dispute.status });

    switch (action) {
      case 'add_message':
        // Add admin message to dispute (private to a specific recipient)
        if (!recipientId || ![dispute.transactions?.user_id, dispute.transactions?.buyer_id].includes(recipientId)) {
          logStep('Invalid recipient for admin message', { recipientId });
          return new Response(
            JSON.stringify({ error: 'Invalid recipientId' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const targetType = recipientId === dispute.transactions?.user_id ? 'admin_to_seller' : 'admin_to_buyer';

        const { error: messageError } = await supabase
          .from('dispute_messages')
          .insert({
            dispute_id: disputeId,
            sender_id: user.id,
            recipient_id: recipientId,
            message: message || '',
            message_type: targetType
          });

        if (messageError) {
          logStep('Failed to add message', { error: messageError });
          throw messageError;
        }

        // Update dispute status if needed
        if (dispute.status === 'escalated') {
          await supabase
            .from('disputes')
            .update({ 
              status: 'negotiating',
              admin_notes: notes || dispute.admin_notes
            })
            .eq('id', disputeId);
        }

        logStep('Admin message added successfully');
        break;

      case 'update_notes':
        // Update admin notes
        const { error: notesError } = await supabase
          .from('disputes')
          .update({ admin_notes: notes || '' })
          .eq('id', disputeId);

        if (notesError) {
          logStep('Failed to update notes', { error: notesError });
          throw notesError;
        }

        logStep('Admin notes updated successfully');
        break;

      case 'escalate':
        // Manually escalate dispute
        const { error: escalateError } = await supabase
          .from('disputes')
          .update({ 
            status: 'escalated',
            escalated_at: new Date().toISOString(),
            admin_notes: notes || dispute.admin_notes
          })
          .eq('id', disputeId);

        if (escalateError) {
          logStep('Failed to escalate dispute', { error: escalateError });
          throw escalateError;
        }

        logStep('Dispute escalated manually');
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Log admin activity
    await supabase
      .from('activity_logs')
      .insert({
        user_id: user.id,
        activity_type: 'admin_dispute_action',
        title: `Action admin sur litige #${disputeId.slice(0, 8)}`,
        description: `Action: ${action}`,
        metadata: {
          dispute_id: disputeId,
          action: action,
          admin_notes: notes
        }
      });

    logStep('Activity logged successfully');

    return new Response(
      JSON.stringify({ success: true, message: 'Action completed successfully' }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logStep('Error occurred', { error: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
};

serve(handler);