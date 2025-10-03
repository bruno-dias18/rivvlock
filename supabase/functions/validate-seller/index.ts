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

  // User client for authentication
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  // Admin client for database operations
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { transactionId } = await req.json();
    
    logger.log("🔍 [VALIDATE-SELLER] Validating seller for transaction:", transactionId);

    // Get user authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authentication required");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Unauthorized");

    logger.log("✅ [VALIDATE-SELLER] User authenticated:", userData.user.id);

    // Get transaction details (using admin client)
    const { data: transaction, error: transactionError } = await adminClient
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (transactionError || !transaction) {
      logger.error("❌ [VALIDATE-SELLER] Transaction not found:", transactionError);
      throw new Error("Transaction not found");
    }

    // Verify user is the seller
    if (transaction.user_id !== userData.user.id) {
      throw new Error("Only the seller can validate completion");
    }

    // Verify transaction is in paid status
    if (transaction.status !== 'paid') {
      throw new Error("Transaction must be in paid status to validate");
    }

    logger.log("✅ [VALIDATE-SELLER] Seller authorization verified");

    // Check if service date has passed to determine if validation deadline should be set immediately
    const serviceDate = new Date(transaction.service_date);
    const now = new Date();
    
    let updateData: any = { 
      seller_validated: true,
      updated_at: new Date().toISOString()
    };
    
    // Only set validation deadline if service date has passed
    if (serviceDate <= now) {
      const validationDeadline = new Date();
      validationDeadline.setHours(validationDeadline.getHours() + 48);
      updateData.validation_deadline = validationDeadline.toISOString();
    }

    // Update seller validation and conditional validation deadline (using admin client)
    const { error: updateError } = await adminClient
      .from("transactions")
      .update(updateData)
      .eq("id", transactionId);

    if (updateError) {
      logger.error("❌ [VALIDATE-SELLER] Error updating transaction:", updateError);
      throw new Error("Failed to update transaction validation");
    }

    logger.log("✅ [VALIDATE-SELLER] Seller validation completed for transaction:", transactionId);

    // Log activity for the seller
    try {
      await adminClient
        .from('activity_logs')
        .insert({
          user_id: userData.user.id,
          activity_type: 'seller_validation',
          title: 'Validation vendeur',
          description: `Vous avez validé la transaction "${transaction.title}"`,
          metadata: {
            transaction_id: transactionId
          }
        });
    } catch (logError) {
      logger.error('❌ [VALIDATE-SELLER] Error logging activity:', logError);
    }

    // Send notification to buyer
    if (transaction.buyer_id) {
      try {
        await adminClient
          .from('activity_logs')
          .insert({
            user_id: transaction.buyer_id,
            activity_type: 'seller_validation',
            title: 'Service terminé',
            description: `Le vendeur a confirmé la fin du service - Votre validation est maintenant requise pour la transaction "${transaction.title}"`,
            metadata: {
              transaction_id: transactionId
            }
          });
        logger.log("✅ [VALIDATE-SELLER] Notification sent to buyer:", transaction.buyer_id);
      } catch (notifError) {
        logger.error('❌ [VALIDATE-SELLER] Error sending notification to buyer:', notifError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Seller validation completed successfully"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    logger.error("Error validating seller:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});