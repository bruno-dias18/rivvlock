import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { logger } from "../_shared/logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const user = userData.user;
    
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

    logger.log("Force escalating dispute:", disputeId, "by admin:", user.id);

    // Get dispute with transaction
    const { data: dispute, error: disputeError } = await adminClient
      .from("disputes")
      .select(`
        *,
        transactions!inner(*)
      `)
      .eq("id", disputeId)
      .single();

    if (disputeError || !dispute) {
      logger.error("Error fetching dispute:", disputeError);
      throw new Error("Dispute not found");
    }

    logger.log("Dispute data:", JSON.stringify(dispute, null, 2));

    const transaction = dispute.transactions;

    if (!transaction) {
      logger.error("Transaction not found for dispute:", disputeId);
      throw new Error("Transaction not found");
    }

    logger.log("Transaction data:", JSON.stringify(transaction, null, 2));

    // Check if already escalated
    if (dispute.status === 'escalated') {
      throw new Error("Dispute is already escalated");
    }

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

    logger.log("✅ Dispute escalated successfully");

    // Create escalated conversations for admin
    const { data: conversations, error: convError } = await adminClient
      .rpc('create_escalated_dispute_conversations', {
        p_dispute_id: disputeId,
        p_admin_id: user.id
      });

    if (convError) {
      logger.error("Error creating escalated conversations:", convError);
    } else {
      logger.log("✅ Created escalated conversations:", conversations);
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

    return new Response(JSON.stringify({ 
      success: true,
      message: "Litige escaladé avec succès",
      conversations
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    logger.error("Error in force-escalate-dispute:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
