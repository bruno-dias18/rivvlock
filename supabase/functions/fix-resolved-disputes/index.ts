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

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    logger.log("🔍 Starting migration to fix resolved disputes...");

    // Find all disputes with accepted proposals but wrong status
    const { data: disputes, error: disputesError } = await supabaseAdmin
      .from("disputes")
      .select(`
        id,
        transaction_id,
        status,
        dispute_proposals (
          id,
          status,
          proposal_type,
          refund_percentage
        )
      `)
      .in("status", ["responded", "open", "negotiating"]);

    if (disputesError) {
      logger.error("❌ Error fetching disputes:", disputesError);
      throw disputesError;
    }

    logger.log(`📊 Found ${disputes?.length || 0} disputes to check`);

    let fixedCount = 0;

    for (const dispute of disputes || []) {
      // Check if there's an accepted proposal
      const acceptedProposal = (dispute.dispute_proposals as any[])?.find(
        (p: any) => p.status === "accepted"
      );

      if (!acceptedProposal) {
        logger.log(`⏭️  Dispute ${dispute.id} has no accepted proposal, skipping`);
        continue;
      }

      logger.log(`🔧 Fixing dispute ${dispute.id} with accepted ${acceptedProposal.proposal_type} proposal`);

      // Determine the correct dispute status based on proposal type
      let newDisputeStatus: string;
      if (acceptedProposal.proposal_type === "partial_refund" || acceptedProposal.proposal_type === "full_refund") {
        newDisputeStatus = "resolved_refund";
      } else if (acceptedProposal.proposal_type === "no_refund") {
        newDisputeStatus = "resolved_release";
      } else {
        logger.log(`⚠️  Unknown proposal type: ${acceptedProposal.proposal_type}, skipping`);
        continue;
      }

      // Update dispute status
      const { error: updateDisputeError } = await supabaseAdmin
        .from("disputes")
        .update({
          status: newDisputeStatus,
          resolved_at: new Date().toISOString(),
          resolution: `Proposition acceptée: ${acceptedProposal.proposal_type}`,
          updated_at: new Date().toISOString()
        })
        .eq("id", dispute.id);

      if (updateDisputeError) {
        logger.error(`❌ Error updating dispute ${dispute.id}:`, updateDisputeError);
        continue;
      }

      // Get transaction details
      const { data: transaction, error: txError } = await supabaseAdmin
        .from("transactions")
        .select("*")
        .eq("id", dispute.transaction_id)
        .single();

      if (txError || !transaction) {
        logger.error(`❌ Error fetching transaction ${dispute.transaction_id}:`, txError);
        continue;
      }

      // Calculate adjusted price for partial refunds
      let adjustedPrice = transaction.price;
      if (acceptedProposal.proposal_type === "partial_refund" && acceptedProposal.refund_percentage) {
        const refundPercentage = Number(acceptedProposal.refund_percentage);
        adjustedPrice = transaction.price * (1 - refundPercentage / 100);
        logger.log(`💰 Adjusting price from ${transaction.price} to ${adjustedPrice} (${refundPercentage}% refund)`);
      }

      // Update transaction to validated with adjusted price
      const { error: updateTxError } = await supabaseAdmin
        .from("transactions")
        .update({
          status: "validated",
          price: adjustedPrice,
          updated_at: new Date().toISOString()
        })
        .eq("id", dispute.transaction_id);

      if (updateTxError) {
        logger.error(`❌ Error updating transaction ${dispute.transaction_id}:`, updateTxError);
        continue;
      }

      logger.log(`✅ Fixed dispute ${dispute.id} -> ${newDisputeStatus}, transaction ${dispute.transaction_id} -> validated`);
      fixedCount++;
    }

    logger.log(`🎉 Migration complete! Fixed ${fixedCount} disputes`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Migration complete! Fixed ${fixedCount} disputes`,
        fixedCount
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    logger.error("❌ Migration error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
