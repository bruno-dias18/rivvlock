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

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    }
  );

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
    const { data: adminRole } = await supabaseClient
      .from('admin_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!adminRole || adminRole.role !== 'admin') {
      throw new Error("Unauthorized: admin access required");
    }

    const { disputeId, proposalType, refundPercentage, message } = await req.json();

    console.log("[ADMIN-PROPOSAL] Creating official admin proposal:", {
      disputeId,
      proposalType,
      refundPercentage,
    });

    // Get dispute details
    const { data: dispute, error: disputeError } = await supabaseClient
      .from("disputes")
      .select("*")
      .eq("id", disputeId)
      .single();

    if (disputeError || !dispute) {
      console.error("Error fetching dispute:", disputeError);
      throw new Error("Dispute not found");
    }

    // Get transaction details separately
    const { data: transaction, error: transactionError } = await supabaseClient
      .from("transactions")
      .select("id, user_id, buyer_id, title")
      .eq("id", dispute.transaction_id)
      .single();

    if (transactionError || !transaction) {
      console.error("Error fetching transaction:", transactionError);
      throw new Error("Transaction not found");
    }

    // Validate dispute status
    if (!['open', 'negotiating', 'responded', 'escalated'].includes(dispute.status)) {
      throw new Error("Dispute cannot accept new proposals");
    }

    // Validate refund percentage for partial refunds
    if (proposalType === 'partial_refund' && (!refundPercentage || refundPercentage < 0 || refundPercentage > 100)) {
      throw new Error("Invalid refund percentage");
    }

    // Create the official admin proposal
    const { data: proposal, error: proposalInsertError } = await adminClient
      .from("dispute_proposals")
      .insert({
        dispute_id: disputeId,
        proposer_id: user.id,
        proposal_type: proposalType,
        refund_percentage: proposalType === 'partial_refund' ? refundPercentage : proposalType === 'full_refund' ? 100 : 0,
        message: message || null,
        status: 'pending',
        admin_created: true,
        requires_both_parties: true,
        buyer_validated: false,
        seller_validated: false,
        expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48h expiry
      })
      .select()
      .single();

    if (proposalInsertError || !proposal) {
      console.error("Error creating proposal:", proposalInsertError);
      throw new Error("Failed to create proposal");
    }

    console.log("[ADMIN-PROPOSAL] Proposal created:", proposal.id);

    // Update dispute status to negotiating
    await adminClient
      .from("disputes")
      .update({ 
        status: 'negotiating',
        updated_at: new Date().toISOString()
      })
      .eq("id", disputeId);

    // Create notification messages to both parties
    const proposalText = proposalType === 'partial_refund'
      ? `Remboursement de ${refundPercentage}%`
      : proposalType === 'full_refund'
      ? 'Remboursement complet (100%)'
      : 'Pas de remboursement';

    const systemMessage = `🔔 PROPOSITION OFFICIELLE DE L'ADMINISTRATION\n\nL'équipe Rivvlock propose la solution suivante : ${proposalText}\n\n${message || ''}\n\n⚠️ Les deux parties (acheteur et vendeur) doivent valider cette proposition pour qu'elle soit appliquée.\n\nVous avez 48 heures pour répondre.`;

    // Message to seller
    await adminClient
      .from("dispute_messages")
      .insert({
        dispute_id: disputeId,
        sender_id: user.id,
        recipient_id: transaction.user_id,
        message: systemMessage,
        message_type: 'admin_to_seller',
      });

    // Message to buyer
    await adminClient
      .from("dispute_messages")
      .insert({
        dispute_id: disputeId,
        sender_id: user.id,
        recipient_id: transaction.buyer_id,
        message: systemMessage,
        message_type: 'admin_to_buyer',
      });

    console.log("[ADMIN-PROPOSAL] Notification messages sent to both parties");

    return new Response(JSON.stringify({ 
      success: true,
      proposal
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("[ADMIN-PROPOSAL] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
