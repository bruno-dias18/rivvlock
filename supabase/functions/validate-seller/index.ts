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
    
    console.log("🔍 [VALIDATE-SELLER] Validating seller for transaction:", transactionId);

    // Get user authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authentication required");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Unauthorized");

    console.log("✅ [VALIDATE-SELLER] User authenticated:", userData.user.id);

    // Get transaction details (using admin client)
    const { data: transaction, error: transactionError } = await adminClient
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (transactionError || !transaction) {
      console.error("❌ [VALIDATE-SELLER] Transaction not found:", transactionError);
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

    console.log("✅ [VALIDATE-SELLER] Seller authorization verified");

    // Set validation deadline to 48 hours from now
    const validationDeadline = new Date();
    validationDeadline.setHours(validationDeadline.getHours() + 48);

    // Update seller validation and set deadline (using admin client)
    const { error: updateError } = await adminClient
      .from("transactions")
      .update({ 
        seller_validated: true,
        validation_deadline: validationDeadline.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", transactionId);

    if (updateError) {
      console.error("❌ [VALIDATE-SELLER] Error updating transaction:", updateError);
      throw new Error("Failed to update transaction validation");
    }

    console.log("✅ [VALIDATE-SELLER] Seller validation completed for transaction:", transactionId);

    return new Response(JSON.stringify({ 
      success: true,
      message: "Seller validation completed successfully"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error validating seller:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});