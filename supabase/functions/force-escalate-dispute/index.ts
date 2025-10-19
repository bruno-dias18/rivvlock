import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { logger } from "../_shared/logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Production-visible step logger
const logStep = (step: string, details?: Record<string, unknown>) => {
  const ts = new Date().toISOString();
  const d = details ? ` | ${JSON.stringify(details)}` : '';
  console.log(`[FORCE-ESCALATE ${ts}] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    }
  );

  // Admin client
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
    const token = bearerMatch ? bearerMatch[1] : "";
    const { data: userData } = await supabaseClient.auth.getUser(token || undefined);
    const user = userData?.user;
    
    if (!user?.id) {
      throw new Error("User not authenticated");
    }

    // Verify user is admin
    const { data: isAdmin } = await supabaseClient.rpc('is_admin', {
      check_user_id: user.id
    });

    if (!isAdmin) {
      throw new Error("Only admins can force escalate disputes");
    }

    const { disputeId } = await req.json();
    logStep('INPUT_VALIDATED_START', { disputeId });

    logger.log("Force escalating dispute:", disputeId, "by admin:", user.id);

    // Get dispute with transaction
    const { data: dispute, error: disputeError } = await adminClient
      .from("disputes")
      .select(`
        *,
        transactions (*)
      `)
      .eq("id", disputeId)
      .single();

    if (disputeError || !dispute) {
      logger.error("Error fetching dispute:", disputeError);
      throw new Error("Dispute not found");
    }

    logStep('DISPUTE_LOADED', { disputeId, transaction_id: dispute.transaction_id, status: dispute.status });

    // If already escalated, return idempotent success
    if (dispute.status === 'escalated') {
      return successResponse({ 
        message: "Déjà escaladé",
      });
    }

    // Ensure we have the transaction
    let transaction = (dispute as any).transactions;
    if (!transaction && dispute.transaction_id) {
      const { data: tx, error: txError } = await adminClient
        .from('transactions')
        .select('*')
        .eq('id', dispute.transaction_id)
        .maybeSingle();
      if (txError) {
        logger.error("Error fetching transaction fallback:", txError);
      }
      transaction = tx ?? null;
    }

    if (!transaction) {
      // Fallback: escalate status even if transaction embed failed
      logStep('TRANSACTION_MISSING_ESCALATE_ONLY', { disputeId });
      const { error: updateError } = await adminClient
        .from("disputes")
        .update({
          status: 'escalated',
          escalated_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", disputeId);

      if (updateError) {
        logger.error("Error updating dispute (no tx):", updateError);
        throw updateError;
      }

      return successResponse({ 
        message: "Litige escaladé (contexte transaction indisponible)",
      });
    }

    logStep('TRANSACTION_LOADED', { transaction_id: transaction.id });

    // Update dispute to escalated status
    const { error: updateError } = await adminClient
      .from("disputes")
      .update({
        status: 'escalated',
        escalated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", disputeId);

    if (updateError) {
      logger.error("Error updating dispute:", updateError);
      throw updateError;
    }

    logger.log("✅ Dispute escaladé (mise à jour statut OK)");

    // Create escalated conversations (idempotent via RPC)
    logStep('CREATING_ESCALATED_CONVERSATIONS', { disputeId, adminId: user.id });
    
    const { data: conversations, error: convError } = await adminClient
      .rpc('create_escalated_dispute_conversations', {
        p_dispute_id: disputeId,
        p_admin_id: user.id
      });

    if (convError) {
      logger.error("Error creating escalated conversations:", convError);
      // Continue anyway - conversations might already exist
    } else {
      logger.log("✅ Escalated conversations ensured:", conversations);
      logStep('CONVERSATIONS_CREATED_OR_VERIFIED', conversations);
    }

    // Insert system message in main conversation
    if (dispute.conversation_id) {
      await adminClient
        .from('messages')
        .insert({
          conversation_id: dispute.conversation_id,
          sender_id: user.id,
          message: '⚠️ Ce litige a été escaladé à un administrateur pour résolution',
          message_type: 'system'
        });
    }

    // Log activities for both parties
    await adminClient.from('activity_logs').insert([
      {
        user_id: transaction.user_id,
        activity_type: 'dispute_escalated',
        title: `Litige escaladé - "${transaction.title}"`,
        description: 'Un administrateur va maintenant gérer ce litige',
        metadata: {
          dispute_id: disputeId,
          transaction_id: transaction.id,
          admin_id: user.id
        }
      },
      {
        user_id: transaction.buyer_id,
        activity_type: 'dispute_escalated',
        title: `Litige escaladé - "${transaction.title}"`,
        description: 'Un administrateur va maintenant gérer ce litige',
        metadata: {
          dispute_id: disputeId,
          transaction_id: transaction.id,
          admin_id: user.id
        }
      }
    ]);

    // Send notifications
    try {
      await supabaseClient.functions.invoke('send-notifications', {
        body: {
          type: 'dispute_escalated',
          transactionId: transaction.id,
          message: `Le litige concernant "${transaction.title}" a été escaladé à un administrateur`,
          recipients: [transaction.user_id, transaction.buyer_id]
        }
      });
    } catch (notificationError) {
      logger.error("Error sending notification:", notificationError);
    }

    return successResponse({ 
      message: "Litige escaladé avec succès",
      conversations
    });

  } catch (error) {
    logger.error("Error in force-escalate-dispute:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResponse(errorMessage, 500);
  }
};

const composedHandler = compose(
  withCors,
  withAuth,
  withRateLimit({ maxRequests: 10, windowMs: 60000 }),
  withValidation(forceEscalateSchema)
)(handler);

serve(composedHandler);
