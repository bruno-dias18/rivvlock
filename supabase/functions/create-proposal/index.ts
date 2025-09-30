import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const user = userData.user;
    
    if (!user?.id) {
      throw new Error("User not authenticated");
    }

    const { disputeId, proposalType, refundPercentage, message } = await req.json();

    console.log("Creating proposal:", { disputeId, proposalType, refundPercentage, userId: user.id });

    // Verify user is involved in the dispute
    const { data: dispute, error: disputeError } = await supabaseClient
      .from("disputes")
      .select(`
        *,
        transactions (
          user_id,
          buyer_id
        )
      `)
      .eq("id", disputeId)
      .single();

    if (disputeError || !dispute) {
      throw new Error("Dispute not found");
    }

    const transaction = dispute.transactions;
    const isInvolved = 
      user.id === dispute.reporter_id ||
      user.id === transaction.user_id ||
      user.id === transaction.buyer_id;

    if (!isInvolved) {
      throw new Error("User not authorized to make proposals in this dispute");
    }

    if (dispute.status !== 'open') {
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
      console.error("Error creating proposal:", proposalError);
      throw proposalError;
    }

    console.log("✅ Proposal created successfully:", proposal.id);

    // Create a message in the dispute to notify the other party
    const proposalText = proposalType === 'partial_refund' 
      ? `Proposition officielle : Remboursement de ${refundPercentage}%`
      : proposalType === 'full_refund'
      ? `Proposition officielle : Remboursement intégral (100%)`
      : `Proposition officielle : Aucun remboursement`;

    await supabaseClient
      .from("dispute_messages")
      .insert({
        dispute_id: disputeId,
        sender_id: user.id,
        message: proposalText + (message ? `\n${message}` : ''),
        message_type: 'proposal',
      });

    return new Response(JSON.stringify({ 
      success: true,
      proposal 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error in create-proposal:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
