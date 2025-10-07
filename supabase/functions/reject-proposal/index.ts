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

  try {
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const user = userData.user;
    
    if (!user?.id) {
      throw new Error("User not authenticated");
    }

    const { proposalId } = await req.json();
    
    if (!proposalId) {
      throw new Error("proposalId is required");
    }

    logger.log("Rejecting proposal:", proposalId);

    // Get the proposal
    const { data: proposal, error: proposalError } = await supabaseClient
      .from("dispute_proposals")
      .select(`
        *,
        disputes (
          *,
          transactions (*)
        )
      `)
      .eq("id", proposalId)
      .single();

    if (proposalError || !proposal) {
      logger.error("Error fetching proposal:", proposalError);
      throw new Error("Proposal not found");
    }

    const dispute = proposal.disputes;
    const transaction = dispute.transactions;

    // Verify user is involved
    const isInvolved = 
      user.id === dispute.reporter_id ||
      user.id === transaction.user_id ||
      user.id === transaction.buyer_id;

    if (!isInvolved) {
      throw new Error("User not authorized to reject this proposal");
    }

    // Verify user is not the proposer
    if (user.id === proposal.proposer_id) {
      throw new Error("Cannot reject your own proposal");
    }

    // Update proposal status to rejected
    const { error: updateError } = await supabaseClient
      .from("dispute_proposals")
      .update({ 
        status: "rejected",
        updated_at: new Date().toISOString()
      })
      .eq("id", proposalId);

    if (updateError) {
      logger.error("Error updating proposal:", updateError);
      throw updateError;
    }

    logger.log("✅ Proposal rejected successfully");

    // Create a message in the dispute
    const proposalText = proposal.proposal_type === 'partial_refund'
      ? `Remboursement de ${proposal.refund_percentage}%`
      : proposal.proposal_type === 'full_refund'
      ? 'Remboursement intégral (100%)'
      : 'Aucun remboursement';

    await supabaseClient
      .from("dispute_messages")
      .insert({
        dispute_id: dispute.id,
        sender_id: user.id,
        message: `❌ Proposition refusée : ${proposalText}`,
        message_type: "system",
      });

    // Log activity for proposer
    await supabaseClient.from('activity_logs').insert({
      user_id: proposal.proposer_id,
      activity_type: 'dispute_proposal_rejected',
      title: `Votre proposition a été refusée - "${transaction.title}"`,
      description: `La proposition "${proposalText}" a été refusée`,
      metadata: {
        dispute_id: dispute.id,
        transaction_id: transaction.id,
        proposal_id: proposalId,
      }
    });

    // Send notification to proposer
    try {
      await supabaseClient.functions.invoke('send-notifications', {
        body: {
          type: 'dispute_proposal_rejected',
          transactionId: transaction.id,
          message: `Votre proposition "${proposalText}" concernant "${transaction.title}" a été refusée`,
          recipients: [proposal.proposer_id]
        }
      });
    } catch (notificationError) {
      logger.error("Error sending notification:", notificationError);
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: "Proposition refusée avec succès"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    logger.error("Error in reject-proposal:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
