import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client with end-user JWT (to check admin)
    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader ?? "" } },
    });

    // Check admin role via secure function
    const { data: isAdmin, error: adminErr } = await supabase.rpc("is_admin");
    if (adminErr) {
      return new Response(JSON.stringify({ error: adminErr.message }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Not authorized" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { transactionId } = await req.json();
    if (!transactionId) {
      return new Response(JSON.stringify({ error: "transactionId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Service role client to bypass RLS safely after admin check
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data, error } = await supabaseAdmin
      .from("transactions")
      .select(
        "id, title, price, currency, service_date, status, seller_display_name, buyer_display_name, user_id, buyer_id"
      )
      .eq("id", transactionId)
      .maybeSingle();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ transaction: data ?? null }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});