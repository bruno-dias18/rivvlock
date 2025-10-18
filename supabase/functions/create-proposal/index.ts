import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { logger } from "../_shared/logger.ts";
import { checkRateLimit, getClientIp } from "../_shared/rate-limiter.ts";
import { validate, createProposalSchema } from "../_shared/validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  
  // Use service role key to bypass RLS for admin operations
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    }
  );

  try {
    // Rate limiting - protection contre les abus
    const clientIp = getClientIp(req);
    await checkRateLimit(clientIp);

    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const user = userData.user;
    
    if (!user?.id) {
      throw new Error("User not authenticated");
    }

    // Rate limiting par utilisateur
    await checkRateLimit(clientIp, user.id);

    // Parse et validation des données
    const requestBody = await req.json();
    const validatedData = validate(createProposalSchema, requestBody);
    const { disputeId, proposalType, refundPercentage, message } = validatedData;

    logger.log("Creating proposal:", { disputeId, proposalType, refundPercentage, userId: user.id });

    // Get the dispute
    const { data: dispute, error: disputeError } = await supabaseClient
      .from("disputes")
      .select("*")
      .eq("id", disputeId)
      .single();

    if (disputeError || !dispute) {
      logger.error("Error fetching dispute:", disputeError);
      throw new Error("Dispute not found");
    }

    // Get the associated transaction
    const { data: transaction, error: transactionError } = await supabaseClient
      .from("transactions")
      .select("*")
      .eq("id", dispute.transaction_id)
      .single();

    if (transactionError || !transaction) {
      logger.error("Error fetching transaction:", transactionError);
      throw new Error("Transaction not found");
    }

    const isInvolved = 
      user.id === dispute.reporter_id ||
      user.id === transaction.user_id ||
      user.id === transaction.buyer_id;

    if (!isInvolved) {
      throw new Error("User not authorized to make proposals in this dispute");
    }

    if (!['open', 'responded', 'negotiating'].includes(dispute.status)) {
      throw new Error("Cannot make proposals on closed disputes");
    }

    // Create the proposal
    const { data: proposal, error: proposalError } = await supabaseClient
      .from("dispute_proposals")
      .insert({
        dispute_id: disputeId,
        proposer_id: user.id,
        proposal_type: proposalType,
        refund_percentage: refundPercentage,
        message: message,
      })
      .select()
      .single();

    if (proposalError) {
      logger.error("Error creating proposal:", proposalError);
      throw proposalError;
    }

    logger.log("✅ Proposal created successfully:", proposal.id);

    // Create a message in the dispute to notify the other party
    let proposalText = '';
    if (proposalType === 'partial_refund') {
      proposalText = `Proposition officielle : Remboursement de ${refundPercentage}%`;
    } else if (proposalType === 'full_refund') {
      proposalText = `Proposition officielle : Remboursement intégral (100%)`;
    } else if (proposalType === 'no_refund') {
      proposalText = `Proposition officielle : Aucun remboursement`;
    } else {
      proposalText = `Proposition officielle : ${proposalType}`;
    }

    // Write to unified conversations/messages if a conversation exists
    if (dispute.conversation_id) {
      await supabaseClient
        .from('messages')
        .insert({
          conversation_id: dispute.conversation_id,
          sender_id: user.id,
          message: proposalText + (message ? `\n${message}` : ''),
          message_type: 'system',
          metadata: {
            proposal_id: proposal.id,
            proposal_type: proposalType,
            refund_percentage: refundPercentage,
            dispute_id: disputeId,
            transaction_id: transaction.id,
          },
        });
    }

    // Log activity for all other participants
    const participants = [transaction.user_id, transaction.buyer_id].filter(id => id && id !== user.id);
    
    for (const participantId of participants) {
      await supabaseClient.from('activity_logs').insert({
        user_id: participantId,
        activity_type: 'dispute_proposal_created',
        title: `Nouvelle proposition dans le litige "${transaction.title}"`,
        description: proposalText,
        metadata: {
          dispute_id: disputeId,
          transaction_id: transaction.id,
          proposal_id: proposal.id,
          proposal_type: proposalType
        }
      });
    }

    // Send notification to all other participants
    try {
      const { error: notificationError } = await supabaseClient.functions.invoke('send-notifications', {
        body: {
          type: 'dispute_proposal_created',
          transactionId: transaction.id,
          message: `Une nouvelle proposition a été faite dans le litige concernant "${transaction.title}". ${proposalText}${message ? ` - ${message}` : ''}`,
          recipients: participants
        }
      });
      
      if (notificationError) {
        logger.error("Error sending notification:", notificationError);
      }
    } catch (notificationError) {
      logger.error("Error invoking send-notifications:", notificationError);
    }

    return new Response(JSON.stringify({
      success: true,
      proposal 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    logger.error("Error in create-proposal:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
