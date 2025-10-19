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

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Fetch all data in parallel with optimized queries
    const [
      transactionsResult,
      disputesResult,
      quotesResult,
      stripeAccountResult,
    ] = await Promise.all([
      // Get transactions with counts
      supabaseClient
        .from("transactions")
        .select("id, status, created_at")
        .or(`user_id.eq.${user.id},buyer_id.eq.${user.id}`)
        .order("created_at", { ascending: false }),
      
      // Get disputes
      supabaseClient
        .from("disputes")
        .select("id, status, transaction_id, created_at")
        .or(`reporter_id.eq.${user.id},transaction_id.in.(select id from transactions where user_id.eq.${user.id} or buyer_id.eq.${user.id})`)
        .not("archived_by_seller", "eq", true)
        .not("archived_by_buyer", "eq", true),
      
      // Get quotes
      supabaseClient
        .from("quotes")
        .select("id, status, created_at")
        .eq("seller_id", user.id)
        .in("status", ["pending", "negotiating"]),
      
      // Get stripe account status
      supabaseClient
        .from("stripe_accounts")
        .select("stripe_account_id, payouts_enabled, charges_enabled, details_submitted")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (transactionsResult.error) {
      console.error("Transactions error:", transactionsResult.error);
    }
    if (disputesResult.error) {
      console.error("Disputes error:", disputesResult.error);
    }
    if (quotesResult.error) {
      console.error("Quotes error:", quotesResult.error);
    }

    // Calculate counts from transactions
    const transactions = transactionsResult.data || [];
    const counts = {
      pending: transactions.filter(t => t.status === "pending").length,
      paid: transactions.filter(t => t.status === "paid").length,
      validated: transactions.filter(t => t.status === "validated").length,
    };

    // Prepare response
    const stripeData = stripeAccountResult.data;
    const dashboardData = {
      counts,
      disputes: disputesResult.data || [],
      quotes: quotesResult.data || [],
      stripeAccount: stripeData ? {
        has_account: !!stripeData.stripe_account_id,
        payouts_enabled: stripeData.payouts_enabled,
        charges_enabled: stripeData.charges_enabled,
        details_submitted: stripeData.details_submitted,
      } : null,
      transactionIds: transactions.map(t => t.id),
    };

    return new Response(JSON.stringify(dashboardData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in get-dashboard-data:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
